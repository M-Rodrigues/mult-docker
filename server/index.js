const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});
pgClient.on('error', () => console.log('Lost PG connection'));

pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.log(err));

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  console.log("Buscanddo no postgres");
  const values = await pgClient.query('SELECT * from values');
  console.log(values)

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  console.log("POST /values " + index)
  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  try {
    let result = await redisClient.hset('values', index, 'Nothing yet!');
    console.log(result);

    result = await redisPublisher.publish('insert', index);
    console.log(result);

    result = await pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
    console.log(result);

    res.send({ working: true });
  } catch (err) {
    console.log(err);
    res.send(err);
  }

});

app.listen(5000, err => {
  if (err) {
    console.log("Erro no servidor da api")
  } else {
    console.log('Listening port 5000');
  }
});
