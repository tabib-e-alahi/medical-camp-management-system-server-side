const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

//middlewares
const corsOptions ={
  origin:'*',
  credentials:true,
  optionSuccessStatus:200,
  }
app.use(cors(corsOptions));
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

    const userCollection = client.db("mediCampsDb").collection("users");
    const campsCollection = client.db("mediCampsDb").collection("camps");
    const participantCollection = client
      .db("mediCampsDb")
      .collection("registrations");

    //  ============================ AUTH RELATED API ==================================
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //middlewares====================================================

    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      // console.log("-----------", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log(token);
      jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyOrganizer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isOrganizer = user?.role === "organizer";
      if (!isOrganizer) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // ========================== users related api=====================================

    app.get("/users", verifyToken, verifyOrganizer, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/organizer/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      // console.log(req.decoded.email);

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let organizer = false;
      if (user) {
        organizer = user?.role === "organizer";
      }
      res.send({ organizer });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/organizer/:id",
      verifyToken,
      verifyOrganizer,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "organizer",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete("/users/:id", verifyToken, verifyOrganizer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // =================================== SERVER RELATED API ============================

    // load all camps data from mongodb database
    app.get("/camps", verifyToken, async (req, res) => {
      // console.log("I am getting hit");
      const result = await campsCollection.find().toArray();
      res.send(result);
    });

    app.post("/camps", verifyToken, verifyOrganizer, async (req, res) => {
      const camp = req.body;
      const result = await campsCollection.insertOne(camp);
      res.send(result);
    });

    app.put("/camps/:id",verifyToken,verifyOrganizer, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedCamps = req.body;
      const camp = {
        $set: {
          name: updatedCamps.name,
          image: updatedCamps.image,
          category: updatedCamps.category,
          description: updatedCamps.description,
          fees: updatedCamps.fees,
          scheduledDateAndTime: updatedCamps.scheduledDateAndTime,
          specializedServicesProvided: updatedCamps.specializedServicesProvided,
          healthcareProfessionalsInAttendance:
            updatedCamps.healthcareProfessionalsInAttendance,
          targetAudience: updatedCamps.targetAudience,
          accommodationInformation: updatedCamps.accommodationInformation,
          cancellationRefundPolicy: updatedCamps.cancellationRefundPolicy,
          venueLocation: updatedCamps.venueLocation,
          whatToBring: updatedCamps.whatToBring,
        },
      };

      const result = await campsCollection.updateOne(filter, camp, options);
      res.send(result);
    });

    app.delete("/camps/:id", verifyToken, verifyOrganizer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campsCollection.deleteOne(query);
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

    app.get("/camp-details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campsCollection.findOne(query);
      res.send(result);
    });

    //send new campy data to data database
    app.post("/campy-data", verifyToken, async (req, res) => {
      const newCampyData = req.body;
      const result = await participantCollection.insertOne(newCampyData);
      res.send(result);
    });

    //send new campy data to data database
    app.post("/campy-data", verifyToken, async (req, res) => {
      const newCampyData = req.body;
      const result = await participantCollection.insertOne(newCampyData);
      res.send(result);
    });

    app.get('/manage-campy-data',verifyToken,verifyOrganizer, async(req,res) =>{
      const result = await participantCollection.find().toArray();
      res.send(result);
    })

    //find the campy data from data database
    app.get("/campy-data", verifyToken, async (req, res) => {
      const { type } = req?.query;
      console.log("Campy type: ", type);

      let query = {};

      // Parse the type parameter to determine if it's an email or ID
      if (type) {
        const criteria = type;

        if (criteria.email) {
          query = { campy_email: criteria.email };
        } else if (criteria.id) {
          query = { camp_id: criteria.id };
        }
      }
      const result = await participantCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/participant-data", verifyToken, async (req, res) => {
      const { email } = req?.query;
      console.log("Campy type: ", email);

      const query = {campy_email: email}
      const result = await participantCollection.find(query).toArray();
      res.send(result);
    });

    //update participantCount
    app.patch(
      "/campy-data/:id",
      verifyToken,
      verifyOrganizer,
      async (req, res) => {
        const id = req.params.id;
        console.log("----:", id);
        const { participants } = req.body;
        console.log("count==:", participants);
        const options = { upsert: true };
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            participantCount: participants,
          },
        };
        const result = await campsCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      }
    );

    app.get('/registered-camps', async (req, res) => {
      const { camp_ids } = req.query;
    
      if (!camp_ids) {
        return res.status(400).send({ error: 'Missing camp_ids parameter' });
      }
    
      const campIdsArray = camp_ids.split(',').map(id => new ObjectId(id));
    
      const result = await campsCollection.find({ _id: { $in: campIdsArray } }).toArray();
      res.send(result);
    });

    app.delete('/registered-camps/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log('Delete id:',id);
      const query = {camp_id: id}
      const result = await participantCollection.deleteOne(query);
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
