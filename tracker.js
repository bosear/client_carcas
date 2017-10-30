var fs = require('fs');
var bencode = require('bencode');
var crypto = require('crypto');
var url = require('url');
var http = require('http');
var peers = [];

//var path = "Cuphead [L] [ENG ENG] (2017) (20170929) [GOG] [rutracker-5459668].torrent";
var path = "kali-linux-2017.2-amd64.torrent";
var torrent = bencode.decode(fs.readFileSync(path));

var info_hash = crypto.createHash('sha1').update(bencode.encode(torrent.info)).digest();

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
    port: 6999,
    uploaded: 0,
    downloaded: 0,
    left: lenghth
};

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

console.log(urlAnnounce);

http.get(options, function (res) {
    console.log('got response: ' + res.statusCode);

    var response = [];

    res.on('data', function (chunk) {
        response.push(chunk);
    });

    res.on('end', function () {
        var body = bencode.decode(Buffer.concat(response));
        peers = parsePeers(body.peers);
        console.log(peers);
    })
}).on("error", function (err) {
    console.log("Error: " + err.message);
});


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