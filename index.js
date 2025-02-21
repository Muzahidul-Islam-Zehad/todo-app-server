require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { format } = require('date-fns');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// AZiYxbXngwhujBOS
// todo-app-zehad


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.j876r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const tasksCollection = client.db('TaskTrek').collection('tasks');
    const usersCollection = client.db('TaskTrek').collection('users');

    // add task api
    app.post('/tasks', async (req, res) => {
      const data = req.body;
      const taskData = {
        ...data, createdAt: format(new Date(), "PP")
      }

      const result = await tasksCollection.insertOne(taskData);
      // console.log(taskData);
      // res.send({message: 'data sent successful'})
      res.send(result);
    })

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

    // app.get('/tasks', async(req, res) =>{
    //   const email = req.query.email;
    //   const query = {email};

    //   const result = await tasksCollection.find(query).toArray();

    //   res.send(result);
    // })

    // get tasks based on category
    app.get('/tasks', async (req, res) => {
      const email = req.query.email;
      const query = { email };

      try {
        const aggregation = await tasksCollection.aggregate([
          { $match: query },
          {
            $group: {
              _id: "$category",
              tasks: { $push: "$$ROOT" } // Push the entire document into an array
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

        // console.log(aggregation);
        res.send(aggregation);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'An error occurred while retrieving tasks.' });
      }
    });

    //update the category
    app.put('/tasks/:id', async(req, res)=>{
      const id = req.params.id;
      const {category} = req.body;

      const query = {_id : new ObjectId(id)};
      const updatedDoc = {
        $set : {
          category
        }
      }

      const result = await tasksCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //delete any task
    app.delete('/tasks/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};

      const result = await tasksCollection.deleteOne(query);
      res.send(result);
    })

    //update task data
    app.patch('/tasks/:id', async(req, res)=>{
      const id = req.params.id;
      const updatedTask = req.body;
      const query = {_id : new ObjectId(id)};
      
      const updatedDoc = {
        $set: {
          ...updatedTask
        }
      }

      const result = await tasksCollection.updateOne(query, updatedDoc);
      res.send(result);
    })


  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is for todo app');
})

app.listen(port, () => {
  console.log('running on port: ', port);
})