'use strict';

// connWithBS(map) has streams(set) has connInfo(obj) has {conn, args}
const connWithBS = new Map();

const addConnToBS = (stream, conn, args) =>{
    const blockedConn = {
        conn: conn,
        args: args,
    }

    if(!connWithBS.has(stream)){
        connWithBS.set(stream, new Set());
    }

    connWithBS.get(stream).add(blockedConn);
}

const getBlockedConn = (stream) =>{
    let conns = [];
    if(connWithBS.has(stream)){
        conns = [...connWithBS.get(stream)];
        connWithBS.delete(stream);
    }
    return conns;
}

module.exports = {addConnToBS, getBlockedConn};
