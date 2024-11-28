'use strict';
const { toRESP } = require("../resp/encode");
const { storedKeys, expiryKeys } = require("../store/cache");
const fs = require('fs');
const { join } = require('path');
const { getKeysValues } = require('../rdb_parser/parser');

const handleConfigGet = (config, args) =>{
    const configResult = [];
    while(args.length > 0){
        const configKey = args.shift();
        const configValue = config.cargs.get(configKey);
        configResult.push(configKey);
        configResult.push(configValue);
    }
    // console.log('ConfigFormatted:\n',toRESP(configResult));
    return toRESP(configResult);
}

const handleKeys = (config, args) =>{
    const pattern = args.shift();
    const redisKeys = [];
    if(pattern == '*'){
        storedKeys.forEach((value,key)=>{
            let toAdd = true;
            if(expiryKeys.has(key) && expiryKeys.get(key).time < new Date()) toAdd = false;
            if(toAdd){
                redisKeys.push(key);
            }
        });
    }
    // console.log('keysFormatted:\n',toRESP(redisKeys));
    return toRESP(redisKeys);
}

const loadData = (rdb)=>{
    const keyValuePairs = getKeysValues(rdb);
    keyValuePairs.forEach(pair=>{
        storedKeys.set(pair.key, pair.value)
        if(pair.type){
            if(pair.type == 'PX') expiryKeys.set(pair.key, {'type': pair.type, 'time' : new Date(+pair.time)});
            if(pair.type == 'EX') expiryKeys.set(pair.key, {'type': pair.type, 'time' : new Date(+pair.time * 1000)});
        }
    });
    console.log('All the KeyValuePairs in File:\n',keyValuePairs);
}

const loadFile = (config)=>{
    let rdb;
    if (config.cargs.get('dir') && config.cargs.get('dbfilename')) {
        const dbPath = join(config.cargs.get('dir'), config.cargs.get('dbfilename'));
        const isDbExists = fs.existsSync(dbPath);
        if (isDbExists) {
            rdb = fs.readFileSync(dbPath);
            if (!rdb) {
                console.error(`Error reading DB at provided path: ${dbPath}`);
            }
            else{
                console.log(`File exist at path: ${dbPath}`);
                loadData(rdb);
                console.log("Stored Keys:\n",storedKeys);
                console.log("Expiry Keys:\n",expiryKeys);
            }
        } else {
            console.error(`DB doesn't exists at provided path: ${dbPath}`);
        }
    }
}

module.exports = {handleConfigGet, handleKeys, loadData, loadFile};