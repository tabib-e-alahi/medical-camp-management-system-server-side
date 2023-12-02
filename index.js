const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o8c7bsg.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const campsCollection = client.db("mediCampsDb").collection("camps");
    const participantCollection = client
      .db("mediCampsDb")
      .collection("participants");

    // load all camps data from mongodb database
    app.get("/camps", async (req, res) => {
      const result = await campsCollection.find().toArray();
      res.send(result);
    });

    // load all camps data from mongodb database
    app.get("/popular-camps", async (req, res) => {
      const { sortBy } = req.query;
      let options = {};
      if (sortBy) {
        if (sortBy === "high") {
          options = {
            sort: { participantCount: -1 },
          };
        } else if (sortBy === "low") {
          options = {
            sort: { participantCount: 1 },
          };
        }
      }

      const query = { category: "popular" };
      const result = await campsCollection.find(query, options).toArray();
      res.send(result);
    });

    app.get("/camp-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campsCollection.findOne(query);
      res.send(result);
    });

    //send new campy data to data database
    app.post("/campy-data", async (req, res) => {
      const newCampyData = req.body;
      const result = await participantCollection.insertOne(newCampyData);
      res.send(result);
    });
    //find the campy data from data database
    app.get("/campy-data", async (req, res) => {
      const { email } = req.query;
      console.log("Campy email: ", email);
      const query = { campy_email: email };
      const result = await participantCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("medical camp mangement system is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
