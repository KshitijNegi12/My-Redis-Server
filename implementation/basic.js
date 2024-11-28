'use strict';
const {storedKeys ,expiryKeys, storedStreams} = require('../store/cache');
const {toRESP, toSimpleString, toNullBulkString} = require('../resp/encode');

const handlePing = (config) =>{
    if(config.role == 'master')
        return toSimpleString('PONG');
}

const handleEcho = (config, args) =>{
    // if(config.role == 'master')
    return toSimpleString(args[0]);
}

const handleSet = (config, args) =>{
    const key = args[0];
    const value = args[1];
    storedKeys.set(key, value);
    if(args.length > 3){
        handleKeyExpiry(args, key);
    }
    if(config.role == 'master'){
        sendPropogationToReplicas(toRESP(['SET',key,value]), config);
        return toSimpleString('OK');
    }
}

const handleKeyExpiry = (args, key) =>{
    const type = args[2].toUpperCase();
    const time = args[3];
    if(type == 'PX'){
        expiryKeys.set(key, {'type': type, 'time' : new Date(new Date().getTime() + +time)});
    }
    else if(type == 'EX'){                    
        expiryKeys.set(key, {'type': type, 'time' : new Date(new Date().getTime() + +time*1000)});
    }
}

const sendPropogationToReplicas = (data, config) =>{
    config.connected_slaves.forEach(slave =>{
        slave.write(data);
    });
    
    if(config.connected_slaves.size){
        config.propagation_count++;
    }
}

const handleGet = (config, args) =>{
    const key = args[0];
    if(storedKeys.has(key)){
        const getValue = storedKeys.get(key);
        const currTime = new Date();
        const expTime = expiryKeys.get(key)?.time;
        // if no exiry for key, or if expiry then, if it's not expired
        if(!expTime || currTime < expTime){
            return toSimpleString(getValue);
        }
        else{
            return toNullBulkString();
        }
    }
    else{
        return toNullBulkString();
    }
}

const handleType = (config, args) => {
    const key = args.shift(); 
    if(storedKeys.has(key)){
        return toSimpleString('string');
    }
    else if(storedStreams.has(key)){
        return toSimpleString('stream');
    }
    else{
        return toSimpleString('none');
    }
}

module.exports = {handlePing, handleEcho, handleSet, handleGet, handleType, sendPropogationToReplicas};