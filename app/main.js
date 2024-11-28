'use strict';
const server = require('../server/server')

const config = {
    host: "127.0.0.1",
    port: 6379,
    role: "master",
	connections: new Set(),
    connected_slaves: new Set(),
    master_replid: "8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb",
    master_repl_offset: 0,
	ack_count: 0,
	ack_needed: 0,
	propagation_count: 0, //pending cmds replica not ack yet
	waiting_for_ack: false,	// is server, waiting for ack from replica?
	cargs : new Map()
}

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
	const arg = args[i];    
	if (arg.startsWith('--')) {
		config.cargs.set(arg.slice(2), args[i + 1]);
		i += 1;
	}
}
console.log("Configs:\n",config.cargs);

if(config.cargs.has('port')){
	config.port = config.cargs.get('port');
	config.cargs.delete('port');
}

if(config.cargs.has('master_replid')){
	config.master_replid = config.cargs.get('master_replid');
	config.cargs.delete('master_replid');
}

if(config.cargs.has('replicaof')){
	config.role = 'slave';
	const masterInfo = config.cargs.get('replicaof');
	config.cargs.delete('replicaof');
	config.master_host = masterInfo.split(' ')[0];
	config.master_port = masterInfo.split(' ')[1];
	delete config.connections;
    delete config.connected_slaves;
}

server.start(config);