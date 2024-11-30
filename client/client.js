const net = require('net');
const readline = require('readline');
const crypto = require('crypto');

const SECRET_KEY = '12345678901234567890123456789012'; // Debe ser idéntico
const IV = Buffer.from('1234567890123456'); // IV fijo de 16 bytes
const SERVER_PORT = 3000;
const SERVER_HOST = '127.0.0.1';

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

let client = null;
let username = null;
let reconnecting = false;

// Crear la interfaz de lectura para el usuario
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Función para conectarse al servidor
function connectToServer() {
    if (client) {
        client.destroy(); // Asegurarse de destruir la conexión previa
    }

    client = new net.Socket();

    client.connect(SERVER_PORT, SERVER_HOST, () => {
        console.log('Conectado al servidor.');
        if (reconnecting) {
            console.log('Reconexión exitosa.');
            reconnecting = false;
        }
    });

    client.on('data', (data) => {
        try {
            const { encryptedMessage, hmac } = JSON.parse(data.toString());
            const message = decryptMessage(encryptedMessage);
            const expectedHmac = generateHmac(encryptedMessage);

            if (hmac !== expectedHmac) {
                console.error('Error: Integridad del mensaje comprometida.');
                return;
            }

            console.log(message);
        } catch (err) {
            console.error('Error al procesar el mensaje recibido:', err.message);
        }
    });

    client.on('close', () => {
        console.log('Conexión cerrada por el servidor. Intentando reconectar...');
        reconnecting = true;
        setTimeout(connectToServer, 3000); // Intentar reconectar cada 3 segundos
    });

    client.on('error', (err) => {
        console.error(`Error: ${err.message}`);
    });
}

// Escuchar entrada del usuario y enviar mensajes
rl.on('line', (input) => {
    if (!username) {
        username = input.trim();
        const message = username;
        const encryptedMessage = encryptMessage(message);
        const hmac = generateHmac(encryptedMessage);

        const payload = JSON.stringify({ encryptedMessage, hmac });
        client.write(payload);
    } else {
        const message = `[${username}]: ${input}`;
        const encryptedMessage = encryptMessage(message);
        const hmac = generateHmac(encryptedMessage);

        const payload = JSON.stringify({ encryptedMessage, hmac });
        client.write(payload);
    }
});

// Iniciar la conexión inicial
connectToServer();
