import express from "express";
import bodyParser from 'body-parser';
import * as btclib from 'bitcoinjs-lib';
import ElectrumClient from 'electrum-client';
const { testnet, bitcoin, regtest } = btclib.networks;

const app = express();
const PORT = 3008;

const EL_SERVER = 'localhost';
const EL_PORT = '50000'

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get("/getutxos/:network/:address", async (req, res) => {
  const address = req.params.address;
  const net = req.params.network;
  const network = net === 'testnet' ? regtest : bitcoin;
  const client = new ElectrumClient(EL_PORT, EL_SERVER, 'tcp');
  await client.connect();
  console.log("Connected");
  const scriptHash = btclib.crypto.sha256(Buffer.from(btclib.address.toOutputScript(address, network))).reverse().toString('hex');
  console.log('Getting ', scriptHash)
  const utxos = await client.blockchainScripthash_listunspent(scriptHash);
  console.log('Got ', utxos)
  const header = await client.blockchain_relayfee();
  const rv = await Promise.all(utxos.map(async utxo => {
    const tx = await client.blockchainTransaction_get(utxo.tx_hash, true);
    console.log(tx);
    return {
        txid: utxo.tx_hash,
        vout: utxo.tx_pos,
        value: utxo.value,
        hex: tx
    };
  }));

  res.json(rv);
});

app.post("/broadcast/:network", async (req, res) => {
  console.log("REQ IS ", req.body)
  const txHex = await req.body.hex;
    try {
         console.log("BROADCASTING:", txHex)
         const client = new ElectrumClient(EL_PORT, EL_SERVER, 'tcp');
         await client.connect();
         console.log("Connected");
         const result = await client.blockchainTransaction_broadcast(txHex);
         // const header = await client.blockchain_relayfee();
         console.log('result:', result)
         res.json({result});
    } catch (error) {
        console.error('Error posting transaction:', error);
        res.json({error: error.toString()});
        //throw error;
    }
});

app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}/`);
});

