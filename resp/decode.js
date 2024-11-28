'use strict';

const parseRESP = (cmds) => {
	while(cmds.length) {
		const element = cmds.shift();
		switch (element[0]) {
			case '+':
                const plusarr = [];
				plusarr.push(element.slice(1));
                if(element.slice(1).includes('FULLRESYNC')){
                    plusarr.push(parseRESP(cmds));
                }
                return plusarr;
			case '*':
				// array
				const arrlen = element.slice(1);
				const arr = [];
				for (let j = 0; j < arrlen; j++) {
					const parsedContent = parseRESP(cmds);
					arr.push(parsedContent[0]);
					cmds = parsedContent[1];
				}
				return arr;
			case '$':
				// string
				const strlen = element.slice(1);
				const str = cmds.shift();
				return [str, cmds];
			case ':':
				// integer
				const integer = element.slice(1);
				return [Number(integer), cmds];
			default:
				return [element, cmds];
		}
	}
};

const parseCommands = (cmds) => {
    // cmds looks like ex [ '*2', '$4', 'KEYS', '$1', '*', '' ]
	const parsedRESP = parseRESP(cmds);
    // parsedRESP looks like ex [ 'KEYS', '*', ]
	const command = parsedRESP.shift();
	switch (command.toUpperCase()) {
        // for CONFIG GET
		case 'CONFIG':
            // GET
			const scndPart = parsedRESP.shift();
			if (scndPart) {
				return {
					cmdName: command.toUpperCase() + ' ' + scndPart.toUpperCase(),
					args: parsedRESP,
				};
			} else {
				return {
					cmdName: command.toUpperCase(),
                    args: [],
				};
			}
			break;
		default:
        // handles
        // ping, echo, set, get, keys, info, replconf, psync
			return {
				cmdName: command.toUpperCase(),
				args: parsedRESP,
			};
			break;
	}
};

module.exports = {parseRESP, parseCommands};