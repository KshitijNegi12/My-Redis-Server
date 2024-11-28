'use strict';
const net = require("net");
const {requestHandler} = require('../handler/requests');
const { isMultiOn } = require("../handler/multiQueues");
const {handShakeWithMaster} = require('./handshake');
const {loadFile} = require('../implementation/persistence');

const createServer = (config) =>{
    const server = net.createServer((connection) =>{
        if(config.role === 'master'){
            config.connections.add(connection);
        }

        connection.on('data', (data) =>{
            const dataToSendBack = requestHandler(connection, data, config, isMultiOn(connection));
            if(dataToSendBack){
                if(typeof dataToSendBack === 'object'){
                    dataToSendBack.forEach(data => {
                        connection.write(data);
                    });
                }
                else{
                    connection.write(dataToSendBack);
                }
            }
        });

        connection.on('close', ()=>{
            // console.log(config.connected_slaves, config.connections);
            if(config.role === 'master'){
                if(config.connected_slaves.has(connection)) config.connected_slaves.delete(connection);
                if(config.connections.has(connection)) config.connections.delete(connection);
            }
            // console.log(config.connected_slaves, config.connections);
        })
    });

    server.listen(config.port, config.host, ()=>{
        console.log(`Redis ${config.role} is listening on port: ${config.port}`);
    });
}

const start = (config) =>{
    createServer(config);
    loadFile(config);
    if(config.role === 'slave'){
        handShakeWithMaster(config);
    }
}

module.exports = {start};