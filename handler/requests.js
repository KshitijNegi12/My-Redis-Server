'use strict';
const {parseCommands} = require('../resp/decode');
const {toSimpleError, toSimpleString} = require('../resp/encode');
const {handlePing, handleEcho, handleSet, handleGet, handleType} = require('../implementation/basic');
const {handleConfigGet, handleKeys} = require('../implementation/persistence');
const { handleInfo, handleReplconf, handlePsync } = require('../implementation/replication');
const { handleXadd, handleXrange, handleXread } = require('../implementation/stream');
const {handleIncr, handleMulti, handleExec, handleMultiOnCmds} = require('../implementation/transaction');

const requestHandler = (connection, data, config, multiOn) => {
    if(multiOn){
        handleMultiOnCmds(connection, data);
        return toSimpleString('QUEUED');
    }
    const cmds = data.toString().split('\r\n');
    // console.log('List of Commands:\n',cmds);
    const parsedCmds =  parseCommands(cmds);
    console.log('Cmds after RESP parsed:\n',parsedCmds);
    const cmdName = parsedCmds.cmdName;
    const args = parsedCmds.args;
    switch (cmdName){
        // basic
        case 'PING':
            return handlePing(config);

        case 'ECHO':
            return handleEcho(config, args);

        case 'SET':
            return handleSet(config, args);
        
        case 'GET':
            return handleGet(config, args);
             
        case 'TYPE':
            return handleType(config, args);

        // persistence
        case 'CONFIG GET':
            return handleConfigGet(config, args);

        case 'KEYS':
            return handleKeys(config, args);

        // replication
        case 'INFO':
            return handleInfo(config, args);

        case 'REPLCONF':
            return handleReplconf(config, args);
            
        case 'PSYNC':
            return handlePsync(connection, config, args);
        
        case 'WAIT':
            return handleWait(config, args);

        // stream
        case 'XADD':
            return handleXadd(config, args);
        
        case 'XRANGE':
            return handleXrange(config, args);
        
        case 'XREAD':
            return handleXread(connection, config, args);

        // transcation
        case 'INCR':
            return handleIncr(config, args);

        case 'MULTI':
            return handleMulti(connection, config, args);

        case 'EXEC':
            return handleExec(connection, config, args);

        default:
            return toSimpleError('Invalid Command!!');
    }
};

module.exports = {requestHandler};