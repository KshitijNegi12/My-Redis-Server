'use strict';

// connWithMulti(map) has conn(list) has {cmdName, args}
const connWithMulti = new Map();

const isMultiOn = (conn) =>{
    if(connWithMulti.has(conn)) return true;
    return false;
}

const addConnToMultiQueue = (conn) =>{
    connWithMulti.set(conn, []);
    return true;
}

const addConnCmdsToQueue = (conn, cmdName, args) =>{
    connWithMulti.get(conn).push({cmdName:cmdName, args:args});
}

const getQueuedCmds = (conn, config) =>{
    const allCmds = connWithMulti.get(conn);
    connWithMulti.delete(conn);
    return allCmds;
}

module.exports = {isMultiOn, addConnToMultiQueue, addConnCmdsToQueue, getQueuedCmds};