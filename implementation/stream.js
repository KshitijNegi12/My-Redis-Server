'use strict';
const {storedStreams} = require('../store/cache');
const {toRESP, toSimpleError, toSimpleString, toNullBulkString} = require('../resp/encode');
const { addConnToBS, getBlockedConn } = require('../handler/blockedStreams');

const handleXadd = (config, args) =>{
    // storedStreams has streams has streamIDs has streamIdVals
    const stream = args[0]; 
    const streamIDs = storedStreams.has(stream)?storedStreams.get(stream):new Map();
    const streamId = args[1];
    const response = validateStream(stream, streamIDs, streamId);
    // console.log('XADD validate response: ',response);
    if(response == true){
        let time, seqNum;
        if(streamId == '*'){
            time = new Date().getTime();
            seqNum = 0;
        }
        else{
            [time, seqNum] = streamId.split('-');
            if(seqNum == '*'){
                // new entry 
                if(streamIDs.size == 0){
                    // exception
                    if(time == '0') seqNum = '1';
                    else seqNum = '0';
                }
                else{
                    const [lastEntryIdTime, lastEntryIdSeqNum] = [...streamIDs.entries()].at(-1)[0].split('-');
                    // console.log('Last:',lastEntryIdTime, lastEntryIdSeqNum);
                    
                    if(lastEntryIdTime == time){
                        seqNum = parseInt(lastEntryIdSeqNum)+1;
                    }
                    else{
                        seqNum = '0';
                    }
                }
            }
        }
        const newStreamId = `${time}-${seqNum}`;
        const streamIdVal = new Map();
        for(let i=2;i<args.length;i+=2){
            const key = args[i];
            const value = args[i+1];
            streamIdVal.set(key,value);
        }
        streamIDs.set(newStreamId, streamIdVal);
        storedStreams.set(stream, streamIDs);
        // handle BLOCK 0 streams
        const blockedConn = getBlockedConn(stream);
        blockedConn.forEach(connInfo =>{
            const conn = connInfo.conn;
            const args = connInfo.args;
            const dataToSend = getXreadData(args);
            conn.write(dataToSend);
        });

        return toRESP(newStreamId);
    }
    else{
        return toSimpleError(response);
    }
}

const validateStream = (stream, streamIDs, id) =>{
    const [time, seqNum] = id.split('-');
    if(id != '*' && streamIDs.size != 0 && id != '0-0'){
        const lastEntryId = [...streamIDs.entries()].at(-1)[0];
        // console.log('Last Entry ID: ',lastEntryId);
        const [lastEntryIdTime, lastEntryIdSeqNum] = lastEntryId.split('-');
        if(lastEntryIdTime > time || ((lastEntryIdTime == time && seqNum != '*' && lastEntryIdSeqNum >= seqNum))){
            return 'ERR The ID specified in XADD is equal or smaller than the target stream top item';
        }
    }
    else if(id == '0-0'){
        return 'ERR The ID specified in XADD must be greater than 0-0';
    }
    return true;
}

const handleXrange = (config, args) =>{
    const stream = args[0];
    const startId = args[1];
    const endId = args[2];
    const result = getBetweenValues(stream, startId, endId); // streamIds + IdFields
    // console.log("XRANGE DATA: ",result);
    if(result.length === 0){
        return toNullBulkString();
    }
    else{
        return toRESP(result);
    }
}

const getBetweenValues = (stream, startId, endId, inclusive=true) =>{
    if (startId === '-') startId = '0-1'
    if (endId === '+') endId = `${Number.MAX_SAFE_INTEGER}-${Number.MAX_SAFE_INTEGER}`;

    if (!storedStreams.has(stream)) return [];
    if (!startId.includes('-')) startId += `-0`;
    if (!endId.includes('-')) endId += `-${Number.MAX_SAFE_INTEGER}`;

    const streamIds = storedStreams.get(stream);
    const requiredIds = []; 
    if(inclusive){
        for(const currId of streamIds.keys()){
            if(currId >= startId && currId <= endId){
                requiredIds.push(currId);
            }
        }
    }
    else{
        for(const currId of streamIds.keys()){
            if(currId > startId && currId <= endId){
                requiredIds.push(currId);
            }
        }
    }

    const result = [];
    requiredIds.forEach(currId => {
        const arr = [currId];
        const subarr = [];
        const currIdFields = streamIds.get(currId);
        for (const key of currIdFields.keys()) {
            subarr.push(key);
            subarr.push(currIdFields.get(key));
        }
        arr.push(subarr);
        result.push(arr);
    });
    
    return result;
}

const handleXread = (conn, config, args) =>{
    const cmd1 = args.shift(); //STREAMS cmd if not BLOCK
    if(cmd1.toUpperCase() == 'BLOCK'){
        const delay = +args.shift();
        args.shift();        
        args = handle$Ids(args);
        // console.log('Updated Args: ',args);
        if(delay > 0){
            setTimeout(()=>{
                return getXreadData(args); // streams + streamIds + IdFields
            },delay);
        }
        // wait forever
        else if(delay == 0){
            addConnToBS(conn, args);
        }
    }
    else{
        return getXreadData(args);
    }
}

const getXreadData = (args)=>{
    const result = [];
    for(let i=0;i<args.length/2;i++){
        const stream = args[i];
        const startId = args[i+args.length/2];
        const endId = `${Number.MAX_SAFE_INTEGER}-${Number.MAX_SAFE_INTEGER}`;
        
        const subarr = [stream];
        const IDsAndFields = getBetweenValues(stream, startId, endId, false);
        if(IDsAndFields.length > 0){
            subarr.push(IDsAndFields);
            result.push(subarr);
        } 
    }
    // console.log("XREAD DATA: ",result);
    
    if(result.length === 0){
        return toNullBulkString();
    }
    else{
        return toRESP(result);
    }
}

// update $ with last entry id/0-0
const handle$Ids = (args) =>{
    for(let i=0;i<args.length/2;i++){
        const stream = args[i];
        const id = args[i+args.length/2];
        if(id == '$'){
            // last entered id in stream
            if(!storedStreams.has(stream)){
                args[i+args.length/2] = '0-0'
            }
            else{
                args[i+args.length/2] = [...storedStreams.get(stream).entries()].at(-1)[0];
            }
        }
    }
    return args;
}

module.exports = { handleXadd, handleXrange, handleXread};
