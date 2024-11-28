'use strict';

// connWithMulti(map) has conn(list) has cmds 
const connWithMulti = new Map();

const isMultiOn = (conn) =>{
    if(connWithMulti.has(conn)) return true;
    return false;
}

const addConnToMultiQueue = (conn) =>{
    connWithMulti.set(conn, []);
    return true;
}

const addConnCmdsToQueue = (conn, cmd) =>{
    connWithMulti.get(conn).push(cmd);
}

const execQueue = (conn) =>{
    let conns = [];
    connWithMulti.delete(conn);
    return conns;
}

module.exports = {isMultiOn, addConnToMultiQueue, addConnCmdsToQueue, execQueue};