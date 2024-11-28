'use strict';
const {storedKeys ,expiryKeys} = require('../store/cache');
const {toRESP, toSimpleError, toSimpleString} = require('../resp/encode');
const { addConnToMultiQueue, isMultiOn, execQueue, addConnCmdsToQueue } = require('../handler/multiQueues');

const handleIncr = (config, args) =>{
    const key = args[0];
    if(checkForKeys(key)){
        return toRESP(Number(storedKeys.get(key)));
    }
    else{
        return toSimpleError('ERR value is not an integer or out of range');
    }
}

const checkForKeys = (key) =>{
    if(storedKeys.has(key)){
        const value = storedKeys.get(key);
        if(!isNaN(value)){
            const currTime = new Date();
            const expTime = expiryKeys.get(key)?.time;
            if(expTime){
                if(currTime < expTime){
                    storedKeys.set(key, String(+value+1));
                }
                else{
                    expiryKeys.delete(key);
                    storedKeys.set(key, '1');
                }
            }
            else{
                storedKeys.set(key, String(+value+1));
            }
            return true;
        }
    }
    else{
        storedKeys.set(key, '1');
        return true;
    }
    return false;
}

const handleMulti = (conn, config, args) =>{
    if(addConnToMultiQueue(conn)){
        return toSimpleString('OK');
    }
    // return 
}

const handleMultiOnCmds = (conn, cmd) =>{
    addConnCmdsToQueue(conn, cmd);
}

const handleExec = (conn, config, args) =>{
    if(!isMultiOn(conn)){
        return toSimpleError('ERR EXEC without MULTI');
    }
    else{
        const execResult = execQueue(conn);
        return toRESP(execResult);
    }
}

module.exports = {handleIncr, handleMulti, handleExec, handleMultiOnCmds};