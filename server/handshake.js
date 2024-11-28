'use strict';
const net = require("net");
const {requestHandler} = require('../handler/requests');
const {toRESP} = require('../resp/encode');
const {parseRESP} = require('../resp/decode');
const {loadData} = require('../implementation/persistence');

const handShakeWithMaster = (config)=>{
	console.log('Current In: Slave Mode');
	const connToMaster = net.createConnection({ port: config.master_port, host: config.master_host });

    connToMaster.on('connect', ()=>{
        connToMaster.write(toRESP(['PING']));
    })

	let isSlaveCapaSended = false;
	connToMaster.on('data', (data)=>{
        const seperateData = data.toString().split('\r\n');
		console.log('Master Response:\n',seperateData);
        
        const response = parseRESP(seperateData);
        
        if(response[0] === 'PONG'){
            connToMaster.write(toRESP(['REPLCONF','listening-port', `${config.port}`]));
        }
        else if(response[0] === 'OK'){
            if(!isSlaveCapaSended){
                connToMaster.write(toRESP(['REPLCONF', 'capa', 'psync2']));
                isSlaveCapaSended = true;
            }
            else{
                connToMaster.write(toRESP(['PSYNC', '?', '-1']));
            }
        }
        else if(response[0].includes('FULLRESYNC')){
            config.master_replid = response[0].split(' ')[1];
            handleRDBSnapshot(connToMaster, data, config);
        }
        else{
            // Handling propagation
            console.log('Propogated Data');
            handlePropogation(connToMaster, data, config);
        }
    });
}

const handleRDBSnapshot = (conn, data, config)=>{
    // len + data
    const concatBuff = data.slice(data.indexOf('$'));
    const rdbBuffLen = +concatBuff.toString().split('\r\n')[0].slice(1);
    const rdbBuffStart = concatBuff.indexOf('\n')+1;
    const rdbBuffer = concatBuff.slice(rdbBuffStart, rdbBuffStart + rdbBuffLen);
    loadData(rdbBuffer);
    // if propogation is received together in same stream
    const dataIdxAfterBuffer = rdbBuffStart + rdbBuffLen;
    if(concatBuff.length > dataIdxAfterBuffer){
        handlePropogation(conn, concatBuff.slice(dataIdxAfterBuffer), config);
    }

}

const handlePropogation = (conn, data, config)=>{
    let queries = data.toString();
    while(queries.length > 0){
        let endOfCurrQuery = queries.indexOf('*',1);
        let currQuery;
        if(endOfCurrQuery == -1){
            currQuery = queries;
            queries = '';
        }
        else{
            currQuery = queries.slice(0,endOfCurrQuery);
            queries = queries.slice(endOfCurrQuery);
        }
        if(currQuery.length <=3){
            config.master_repl_offset += currQuery.length;
            continue;
        } 
        // do changes in own state without ack to master
        const dataBack = requestHandler(conn, currQuery, config);
        if(dataBack){
            if(typeof dataBack === 'object'){
                dataBack.forEach(data => {
                    conn.write(data);
                });
            }
            else{
                conn.write(dataBack);
            }
        }
        config.master_repl_offset += currQuery.length;
    }
}

module.exports = {handShakeWithMaster};