const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors({ origin: "*" })); // Allow all origins
app.use(express.json());

const admin = require("firebase-admin");

const serviceAccount = require("path/to/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});



// Optional request logging for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// MongoDB connection
const uri =
  "mongodb+srv://studyMateDB:RAIKDThEnWJMoKnF@cluster0.ik3guvg.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("studyDB");

    const userCollection = db.collection("user");
    const partnerRequestCollection = db.collection("partnerRequest");

    // GET all users
    app.get("/user", async (req, res) => {
      try {
        const allUsers = await userCollection.find().toArray();
        res.status(200).json(allUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    // GET top-rated users
    app.get("/user/top-rated", async (req, res) => {
      try {
        const limit = parseInt(req.query.limit, 10) || 5;
        const projection = {
          profileimage: 1,
          name: 1,
          subject: 1,
          skills: 1,
          rating: 1,
        };

        const users = await userCollection
          .find({}, { projection })
          .sort({ rating: -1 })
          .limit(limit)
          .toArray();

        res.status(200).json(users);
      } catch (err) {
        console.error("Error fetching top-rated users:", err);
        res.status(500).json({ error: "Failed to fetch top-rated users" });
      }
    });

    // GET user by ID
    app.get("/user/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid user ID" });
        }

        const result = await userCollection.findOne({ _id: new ObjectId(id) });
        if (!result) return res.status(404).json({ error: "User not found" });

        res.status(200).json(result);
      } catch (err) {
        console.error("Error fetching user by ID:", err);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    });

    // POST create new user
    app.post("/user", async (req, res) => {
      try {
        const newUser = req.body;
        const result = await userCollection.insertOne(newUser);
        res.status(201).json({ insertedId: result.insertedId });
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).json({ error: "Failed to create user profile" });
      }
    });

    // GET partner requests by userEmail
    app.get("/partner-request", async (req, res) => {
      try {
        const { userEmail } = req.query;
        if (!userEmail) {
          return res
            .status(400)
            .json({ error: "Missing userEmail query parameter" });
        }

        const requests = await partnerRequestCollection
          .find({ userEmail })
          .toArray();

        res.status(200).json(requests);
      } catch (err) {
        console.error("Fetch Partner Requests Error:", err);
        res.status(500).json({ error: "Failed to fetch partner requests" });
      }
    });

    // POST create new partner request
    app.post("/partner-request", async (req, res) => {
      try {
        const newRequest = req.body; // should include userEmail
        if (!newRequest.userEmail || !newRequest.partnerName) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const result = await partnerRequestCollection.insertOne(newRequest);
        res.status(201).json({ insertedId: result.insertedId });
      } catch (err) {
        console.error("Create Partner Request Error:", err);
        res.status(500).json({ error: "Failed to create partner request" });
      }
    });

    // PATCH - Update partner request (FINAL WORKING VERSION)
    app.patch("/partner-request/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        // Support both string ID and ObjectId
        let query;
        try {
          query = { _id: new ObjectId(id) };
        } catch {
          return res.status(400).json({ error: "Invalid ID format" });
        }

        const result = await partnerRequestCollection.findOneAndUpdate(
          query,
          { $set: { ...updates, updatedAt: new Date() } },
          { returnDocument: "after" }
        );

        if (!result.value) {
          console.log("Not found: Attempted ID ->", id); // Debug log
          return res
            .status(404)
            .json({ error: "Request not found or you don't own it" });
        }

        res.json(result.value);
      } catch (err) {
        console.error("PATCH Error:", err.message);
        res.status(500).json({ error: "Server error", details: err.message });
      }
    });

    // DELETE partner request
    app.delete("/partner-request/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid request ID" });
        }

        const result = await partnerRequestCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Request not found" });
        }

        res.status(200).json({ message: "Request deleted successfully" });
      } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: "Failed to delete request" });
      }
    });

    // MongoDB Ping
    await client.db("admin").command({ ping: 1 });
    console.log(" Successfully connected to MongoDB!");
  } finally {
    // keep connection open
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
