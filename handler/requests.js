'use strict';
const {parseCommands, parseRESP} = require('../resp/decode');
const {toSimpleError, toSimpleString, toRESP} = require('../resp/encode');
const {handlePing, handleEcho, handleSet, handleGet, handleType} = require('../implementation/basic');
const {handleConfigGet, handleKeys} = require('../implementation/persistence');
const { handleInfo, handleReplconf, handlePsync, handleWait } = require('../implementation/replication');
const { handleXadd, handleXrange, handleXread } = require('../implementation/stream');
const {handleIncr, handleMulti, handleExec, handleCmdsOnMulti} = require('../implementation/transaction');

const requestHandler = (connection, data, config, multiOn) => {
    const cmds = data.toString().split('\r\n');
    // console.log('List of Commands:\n',cmds);
    const parsedCmds =  parseCommands(cmds);
    console.log('Cmds after RESP parsed:\n',parsedCmds);
    const cmdName = parsedCmds.cmdName;
    const args = parsedCmds.args;
    if(multiOn && cmdName != 'EXEC'){
        handleCmdsOnMulti(connection, cmdName, args);
        return toSimpleString('QUEUED');
    }
    return handleCmds(connection, config, cmdName, args);
};

const handleCmds = (connection, config, cmdName, args) =>{
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
            return handleWait(connection, config, args);

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
            const allCmds = handleExec(connection, config, args);
            if(typeof allCmds == 'string') return allCmds;
            const result = [];
            allCmds.forEach(cmd => {
                const execCmdName = cmd.cmdName;
                const execArgs = cmd.args;
                let cmdResult = handleCmds(connection, config, execCmdName, execArgs);
                if(cmdResult){
                    cmdResult = cmdResult.split('\r\n');
                    cmdResult.pop();
                    result.push(parseRESP(cmdResult)[0]);
                }

            });
            // console.log(result);
            return toRESP(result);

        default:
            return toSimpleError('Invalid Command!!');
    }
}

module.exports = {requestHandler};