require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { format } = require('date-fns');
const WebSocket = require("ws"); // ✅ Added WebSocket import
const http = require('http')
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.j876r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const server = http.createServer(app);

// ✅ Added WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("✅ Client connected to WebSocket");

    ws.on("close", () => {
        console.log("❌ Client disconnected from WebSocket");
    });
});

async function run() {
  try {
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log("✅ Connected to MongoDB!");

    const tasksCollection = client.db('TaskTrek').collection('tasks');
    const usersCollection = client.db('TaskTrek').collection('users');

    // ✅ MongoDB Change Stream to watch for real-time updates
    const changeStream = tasksCollection.watch();

    changeStream.on("change", (change) => {
        // console.log("🟢 Change detected:", change);

        // Broadcast changes to all WebSocket clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(change));
            }
        });
    });

    // ✅ Add Task API (Triggers WebSocket Update)
    app.post('/tasks', async (req, res) => {
      const data = req.body;
      const taskData = {
        ...data, createdAt: format(new Date(), "PP")
      }

      const result = await tasksCollection.insertOne(taskData);
      res.send(result);
    });

    // ✅ Add User API
    app.post('/user', async (req, res) => {
      const userData = req.body;
      const query = { email: userData?.email };
      const isExist = await usersCollection.countDocuments(query);

      if (!isExist) {
        const result = await usersCollection.insertOne(userData);
        res.send(result);
      }
      res.send({ message: false });
    });

    // ✅ Get Tasks by Category (Triggers WebSocket Update)
    app.get('/tasks', async (req, res) => {
      const email = req.query.email;
      const query = { email };

      try {
        const aggregation = await tasksCollection.aggregate([
          { $match: query },
          {
            $group: {
              _id: "$category",
              tasks: { $push: "$$ROOT" } 
            }
          },
          {
            $project: {
              category: "$_id",
              tasks: 1,
              _id: 0
            }
          }
        ]).toArray();

        res.send(aggregation);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'An error occurred while retrieving tasks.' });
      }
    });

    // ✅ Update Task Category (Triggers WebSocket Update)
    app.put('/tasks/:id', async(req, res)=>{
      const id = req.params.id;
      const {category} = req.body;
      const query = {_id : new ObjectId(id)};
      const updatedDoc = { $set : { category } };

      const result = await tasksCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // ✅ Delete Task (Triggers WebSocket Update)
    app.delete('/tasks/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await tasksCollection.deleteOne(query);
      res.send(result);
    });

    // ✅ Update Task Data (Triggers WebSocket Update)
    app.patch('/tasks/:id', async(req, res)=>{
      const id = req.params.id;
      const updatedTask = req.body;
      const query = {_id : new ObjectId(id)};
      
      const updatedDoc = {
        $set: { ...updatedTask }
      };

      const result = await tasksCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

  } finally {
    // await client.close(); // Don't close connection to keep real-time updates running
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server is for todo app');
});

server.listen(port, () => {
  console.log('🚀 Server running on port:', port);
});
