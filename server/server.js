const net = require('net');
const crypto = require('crypto');

const SECRET_KEY = '12345678901234567890123456789012';
const IV = Buffer.from('1234567890123456');

function encryptMessage(message) {
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, IV);
    let encrypted = cipher.update(message, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptMessage(encryptedMessage) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, IV);
    let decrypted = decipher.update(encryptedMessage, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}

function generateHmac(message) {
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(message);
    return hmac.digest('hex');
}

const clients = [];

const server = net.createServer((socket) => {
    console.log('Un nuevo cliente se ha conectado.');

    let username = null;

    socket.write(
        JSON.stringify({
            encryptedMessage: encryptMessage('Por favor, ingresa tu nombre de usuario:'),
            hmac: generateHmac(encryptMessage('Por favor, ingresa tu nombre de usuario:')),
        })
    );

    socket.on('data', (data) => {
        try {
            const { encryptedMessage, hmac } = JSON.parse(data.toString());
            const message = decryptMessage(encryptedMessage);
            const expectedHmac = generateHmac(encryptedMessage);

            if (hmac !== expectedHmac) {
                socket.write(
                    JSON.stringify({
                        encryptedMessage: encryptMessage('Error: Integridad comprometida. Cerrando conexión.'),
                        hmac: generateHmac(encryptMessage('Error: Integridad comprometida. Cerrando conexión.')),
                    })
                );
                socket.end();
                return;
            }

            if (!username) {
                if (clients.some((client) => client.username === message)) {
                    const errorMessage = 'Este nombre de usuario ya está en uso. Por favor, elige otro.';
                    socket.write(
                        JSON.stringify({
                            encryptedMessage: encryptMessage(errorMessage),
                            hmac: generateHmac(encryptMessage(errorMessage)),
                        })
                    );
                } else {
                    username = message;
                    clients.push({ socket, username });
                    console.log(`${username} se ha unido al chat.`);
                    socket.write(
                        JSON.stringify({
                            encryptedMessage: encryptMessage(`¡Bienvenido al chat, ${username}!`),
                            hmac: generateHmac(encryptMessage(`¡Bienvenido al chat, ${username}!`)),
                        })
                    );
                    broadcast(
                        JSON.stringify({
                            encryptedMessage: encryptMessage(`${username} se ha unido al chat.`),
                            hmac: generateHmac(encryptMessage(`${username} se ha unido al chat.`)),
                        }),
                        socket
                    );
                }
            } else {
                broadcast(
                    JSON.stringify({
                        encryptedMessage: encryptMessage(message),
                        hmac: generateHmac(encryptMessage(message)),
                    }),
                    socket
                );
            }
        } catch (err) {
            console.error('Error al procesar los datos:', err.message);
        }
    });

    socket.on('end', () => {
        console.log(`${username || 'Un cliente'} se ha desconectado.`);
        const index = clients.findIndex((client) => client.socket === socket);
        if (index !== -1) clients.splice(index, 1);
        if (username) {
            broadcast(
                JSON.stringify({
                    encryptedMessage: encryptMessage(`${username} ha salido del chat.`),
                    hmac: generateHmac(encryptMessage(`${username} ha salido del chat.`)),
                }),
                socket
            );
        }
    });

    socket.on('error', (err) => {
        console.error(`Error en el socket: ${err.message}`);
    });
});

function broadcast(message, senderSocket) {
    clients.forEach((client) => {
        if (client.socket !== senderSocket) {
            client.socket.write(message);
        }
    });
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor TCP corriendo en el puerto ${PORT}`);
});
