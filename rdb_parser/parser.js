'use strict';
const redis_main_const = {
	REDIS_MAGIC_STRING: 5, // Offset for Redis Magic String
	REDIS_VERSION: 4, // Version offset
};

const OPCODES = {
	EOF: 0xff, // End of file
	SELECTDB: 0xfe, // Database selection
	EXPIRETIME: 0xfd, // Expiration time in seconds
	EXPIRETIMEMS: 0xfc, // Expiration time in milliseconds
	RESIZEDB: 0xfb, // Resize DB, hash table size information, key-value and expiry
	AUX: 0xfa, // Auxiliary fields
};

function handleLengthEncoding(data, cursor) {
	const byte = data[cursor];
	const lengthType = (byte & 0b11000000) >> 6;  //first two bits represent length type

	//  00 -> 6 bits length
	if (lengthType === 0) {
		const length = byte & 0b00111111; // Get the 6 bits length
		return [0, length, cursor + 1];
	}

	// 01 -> 14 bits length
	if (lengthType === 1) {
        // 1st byte last 6 bits + 2nd byte 8 bits
		const length = ((byte & 0b00111111) << 8) | data[cursor + 1]; // 14-bit length (big-endian)
		return [1, length, cursor + 2];
	}

	// 10 -> 32 bits length
	if (lengthType === 2) {
		// Skip this byte and read the next 4 bytes as 32-bit length (big-endian)
		const length = data.readUInt32BE(cursor + 1);  // read next 32-bit unsigned integer (Big-Endian)
		return [2, length, cursor + 5];
	}

	// 11 -> string encoding types
	if (lengthType === 3) {
		const stringType = byte & 0b00111111;  //last 6 bits represent string type
        
		if (stringType === 0) { 
			const length = data[cursor + 1];  // 8-bit integer (next byte)
			return [3, length, cursor + 2];
		} 
		else if (stringType === 1) {  
			const length = data.readUInt16LE(cursor + 1);  // next 2 bytes for 16-bit length (Little-endian)
			return [3, length, cursor + 3];
		}
		else if (stringType === 2) { 
			const length = data.readUInt32LE(cursor + 1);  // next 4 bytes for 32-bit length (Little-endian)
			return [3, length, cursor + 5];
		} else {
			throw new Error(`Invalid string type ${stringType} at ${cursor}`);
		}
	}

	throw new Error(`Invalid length encoding ${lengthType} at ${cursor}`);
}

function getKeysValues(data) {
	// console.log(data.toString('hex'));
	const { REDIS_MAGIC_STRING, REDIS_VERSION } = redis_main_const;
	// skipping header
	let cursor = REDIS_MAGIC_STRING + REDIS_VERSION;
	console.log('Header: ', data.slice(0, cursor).toString());
	const keyValuePairs = [];
	
	while (cursor < data.length) {
        let redisKey, redisValue, keyExpireType = null, expireTime = null, type;
		// handling EOF, skipping checksum
		if (data[cursor] === OPCODES.EOF) break;

		// handling metdata
		if(data[cursor] === OPCODES.AUX){
			cursor++;
			let length;
			// key
			try{
				[type, length, cursor] = handleLengthEncoding(data, cursor);
				if(length <= 0) break;
			} catch (error) {
				console.error(`Error decoding key length at cursor ${cursor}: ${error.message}`);
				break;
			}
			const auxKey = data.slice(cursor, cursor+length).toString();
			cursor += length;

			// val
			try{
				[type, length, cursor] = handleLengthEncoding(data, cursor);
				if(length <= 0) break;
			} catch (error) {
				console.error(`Error decoding value length at cursor ${cursor}: ${error.message}`);
				break;
			}
			let auxVal;
			if(type == 3){
				auxVal = length.toString();
			}
			else{
				auxVal = data.slice(cursor, cursor+length).toString();
				cursor += length;	
			} 

			console.log(`Metadata: ${auxKey}: ${auxVal}`);
		}

		// handling database section
		if (data[cursor] === OPCODES.SELECTDB) {
			cursor++;
			let dbIndex;
			try{
			[type, dbIndex, cursor] = handleLengthEncoding(data, cursor);
			console.log('Database Index: ', dbIndex);
			} catch (error) {
				console.error(`Error decoding databaseIndex at cursor ${cursor}: ${error.message}`);
				break;
			}			
		}

		// handling table size
		if (data[cursor] === OPCODES.RESIZEDB) {
			cursor++;
			let keyValueTableSize;
			try{
				[type, keyValueTableSize, cursor] = handleLengthEncoding(data, cursor);
			} catch (error) {
				console.error(`Error decoding keyValueTable length at cursor ${cursor}: ${error.message}`);
				break;
			}
			
			let expiryKeyTableSize;
			try{
				[type, expiryKeyTableSize, cursor] = handleLengthEncoding(data, cursor);
			} catch (error) {
				console.error(`Error decoding expiryTable length at cursor ${cursor}: ${error.message}`);
				break;
			}
			console.log('keyValueTableSize: ', keyValueTableSize);
			console.log('ExpiryKeyTableSize: ', expiryKeyTableSize);			
		}

		// Handle expiration time EXPIRETIME
		if (data[cursor] === OPCODES.EXPIRETIME) {
			cursor++;
            keyExpireType = 'EX';
            expireTime = data.readUInt32LE(cursor).toString();
			// Skip 4 bytes for EXPIRETIME
			cursor += 4; 
		}

        // Handle expiration time EXPIRETIMEMS
		if (data[cursor] === OPCODES.EXPIRETIMEMS) {
			cursor++;
            keyExpireType = 'PX';
            // Ex-
            // 00 9c ef 12 7e 01 00 00 BE
            // 00 00 01 7e 12 ef 9c 00 LE
            // 12 ef 9c 00 low LE
            // 00 00 01 7e high LE
            const low = data.readUInt32LE(cursor); // Read the lower 32 bits
            const high = data.readUInt32LE(cursor + 4); // Read the upper 32 bits
            expireTime = (BigInt(high) << 32n | BigInt(low)).toString();
			// Skip 8 bytes for EXPIRETIMEMS
			cursor += 8; 
		}

		// Extract key-values
		// flag 00 specify string
		if(data[cursor] === 0){
			cursor++;
			// get key
			let redisKeyLength;
			try {
				[type, redisKeyLength, cursor] = handleLengthEncoding(data, cursor);
				if (redisKeyLength <= 0) break;
			} catch (error) {
				console.error(`Error decoding key length at cursor ${cursor}: ${error.message}`);
				break;
			}
			redisKey = data.subarray(cursor, cursor + redisKeyLength).toString();
			cursor += redisKeyLength;
	
			// get value
			let redisValueLength;
			try {
				[type, redisValueLength, cursor] = handleLengthEncoding(data, cursor);
				if (redisValueLength <= 0) break;
			} catch (error) {
				console.error(`Error decoding value length at cursor ${cursor}: ${error.message}`);
				break; 
			}
			redisValue = data.subarray(cursor, cursor + redisValueLength).toString();
			cursor += redisValueLength;
	
			keyValuePairs.push({ key: redisKey, value: redisValue, type: keyExpireType, time: expireTime });
		}
	}

	return keyValuePairs;
}

module.exports = {
	getKeysValues,
};
