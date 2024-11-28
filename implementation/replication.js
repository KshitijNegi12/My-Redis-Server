'use strict'

const { toRESP, toNullBulkString, toSimpleString } = require("../resp/encode");

// # Replication
// role:master
// master_replid:8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb
// master_repl_offset:0
// connected_slaves:0

const handleInfo = (config, args) =>{
    const cmd = args.shift();
    if(cmd == 'replication'){
        if(config.role == 'slave'){
            return toRESP(`role:${config.role}`);
        }
        else{
            return toRESP(`role:${config.role}\r\nmaster_replid:${config.master_replid}\r\nmaster_repl_offset:${config.master_repl_offset}`);
        }
    }
    return toNullBulkString();
}

const handleReplconf = (config, args) =>{
    // from master to slave
    if(args[0].toUpperCase() === 'GETACK'){
        return toRESP(['REPLCONF', 'ACK', config.master_repl_offset.toString()]);
    }
    // from slave to master
    else if(args[0].toUpperCase() === 'ACK'){
        config.ack_count++;
        if(config.ack_count == config.connected_slaves.size){
            config.waiting_for_ack = false;
            config.ack_count = 0;
        }
    }
    // handle master response during handshake
    else{
        return toSimpleString('OK');
    }
}

const handlePsync = (conn, config, args) =>{
    const result = [];
    if(args[0] == '?' && args[1] == '-1'){
        config.connected_slaves.add(conn);
        result.push(toSimpleString(`FULLRESYNC ${config.master_replid} ${config.master_repl_offset}`));
        // temp rdb data in base64
        const base64 = 'UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==';
        const bufferRDB = Buffer.from(base64, 'base64');
        const finalData = Buffer.concat([Buffer.from(`$${bufferRDB.length.toString()}\r\n`), bufferRDB]);
        // console.log('RDB File sended to Replica in buffer form:\n',finalData);	
        result.push(finalData);		
    }	 
    return result;
}

const handleWait = (conn, config, args) =>{
    config.ack_count = 0;
    config.ack_needed = args[0];
    // if no pending cmds to process, it means all replicas is sync and we don't need to wait
    if(config.propagation_count == 0){
        return toRESP(config.connected_slaves.size);
    }
    // if yes, then get the no. of replicas which are sync in given delay
    else{
        config.waiting_for_ack = true;
        const getAckMsg = toRESP(['REPLCONF','GETACK', '*']);
        config.connected_slaves.forEach(slave =>{
            slave.write(getAckMsg);
        });
    }

    setTimeout(()=>{
        if(config.waiting_for_ack){
            conn.write(toRESP(config.ack_count));
        }
        else{
            conn.write(toRESP(config.connected_slaves.size));
        }
    },+args[1]);
}

module.exports = {handleInfo, handleReplconf, handlePsync, handleWait};