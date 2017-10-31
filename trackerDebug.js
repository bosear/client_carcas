var fs = require('fs');
var bencode = require('bencode');
var crypto = require('crypto');
var url = require('url');
var http = require('http');
var net = require('net');
var peers = [];

//var path = "Cuphead [L] [ENG ENG] (2017) (20170929) [GOG] [rutracker-5459668].torrent";
var path = "kali-linux-2017.2-amd64.torrent";
var torrent = bencode.decode(fs.readFileSync(path));

fs.writeFileSync('torrent.txt', JSON.stringify(torrent));
console.log("1. Torrent info saved in torrent.txt");

var info_hash = crypto.createHash('sha1').update(bencode.encode(torrent.info)).digest();


var protocol = "BitTorrent protocol";

//info_hash === Buffer.from(info_hash.toString('hex'), 'hex')


var pieces = [];
var id = null; // peer id
var lenghth = 0;

for (var i = 0; i < torrent.info.files.length; i++)
    lenghth += torrent.info.files[i].length;

for (var i = 0; i < torrent.info.pieces.length; i += 20)
    pieces.push(torrent.info.pieces.slice(i, i + 20));

var urlAnnounce = url.parse(torrent.announce.toString());

var params = {
    infoHash: escape(info_hash.toString('binary')),
    peerId: escape(genId().toString('binary')),
    port: 6881,
    uploaded: 0,
    downloaded: 0,
    left: lenghth
};

fs.writeFileSync('parameters_request.txt', JSON.stringify(params));
console.log("2. Parameters of request saved in parameters_request.txt");

var protocol = "BitTorrent protocol";
var handshake = Buffer.concat([
    Buffer.from([protocol.length]),
    Buffer.from(protocol),
    Buffer.alloc(8),
    info_hash,
    genId()
]);

var query = '?info_hash=' + params.infoHash +
    '&peer_id=' + params.peerId +
    '&port=' + params.port +
    '&uploaded=' + params.uploaded +
    '&downloaded=' + params.downloaded +
    '&left=' + params.left +
    '&event=started';

var options = {
    hostname: urlAnnounce.hostname,
    path: urlAnnounce.pathname + query,
    port: urlAnnounce.port
};

http.get(options, function (res) {
    console.log('got response: ' + res.statusCode);

    var response = [];

    res.on('data', function (chunk) {
        response.push(chunk);
    });

    res.on('end', function () {
        var body = bencode.decode(Buffer.concat(response));

        fs.writeFileSync('parameters_response.txt', JSON.stringify(body));
        console.log("3.1. Parameters of response saved in parameters_response.txt");

        peers = parsePeers(body.peers);

        fs.writeFileSync('peers.txt', JSON.stringify(peers));
        console.log("3.2. Peers saved in peers.txt");

        fs.writeFileSync('handshake.txt', handshake.toString());
        console.log("4. Start message saved in handshake.txt");

        var count = 0;
        console.log('number sockets: ' + peers.length);

        peers.forEach(peer => {
            var socket = new net.Socket();
            var hand = true;
            var chunks = [];
            socket.connect(peer.port, peer.ip, function () {
                console.log('Connected + ' + ++count);

                socket.write(handshake, () => {
                    console.log('Handshake sent');
                });

            });

            socket.on('error', function (err) {
                socket.end();
                socket.destroy();
            });

            socket.on('data', data => {
                chunks.push(data);
            });

            socket.on('end', () => {
                var bitfieldLen = null;
                var responsePeer = Buffer.concat(chunks);
                console.log("Received: " + responsePeer.toString('hex'));
                var elem = Buffer.concat(chunks)[71];
                if (responsePeer.length > 71) {
                    bitfieldLen = responsePeer[70] << 8 | responsePeer[71];
                    console.log('Bitfield length: ' + bitfieldLen);

                    var bitfield = '';
                    for (var i = 73; i < responsePeer.length && (72 + bitfieldLen); i++)
                        bitfield += '0x' + responsePeer[i].toString(16).toUpperCase() + ' ';

                    console.log("Final bitfield: " + bitfield);

                    fs.writeFileSync('bitfield.txt', bitfield);
                    console.log("5. Bitfield in \'hex\' saved in bitfield.txt");
                }
            });
        });
    })
}).on("error", function (err) {
    console.log("Error: " + err.message);
});

/*----------HELPERS----------*/

function genId() {
    if (!id) {
        id = crypto.randomBytes(20);
        Buffer.from('-AT0001-').copy(id, 0);
    }
    return id;
}

function parsePeers(peers) {
    var listPeers = [];
    for (var i = 0; i < peers.length; i += 6)
        listPeers.push(peers.slice(i, i + 6));
    return listPeers.map(parsePeer);
}

function parsePeer(buf) {
    var ip = `${buf[0]}.${buf[1]}.${buf[2]}.${buf[3]}`;
    var port = buf[4] << 8 | buf[5];
    return {
        ip: ip,
        port: port
    }
}