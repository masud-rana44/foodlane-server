const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from API");
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ENDPOINTS
async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    const db = client.db("FoodLaneDB");

    // User collection
    const usersCollection = db.collection("users");

    app.post("/users", async (req, res) => {
      try {
        const newUser = req.body;
        const result = await usersCollection.insertOne(newUser);
        res.status(201).send(result);
      } catch (error) {
        console.log("USER_POST", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    // Food collection
    const foodsCollection = db.collection("foods");

    app.get("/foods", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const size = parseInt(req.query.size) || 10;

        const result = await foodsCollection
          .find()
          .skip((page - 1) * size)
          .limit(size)
          .toArray();

        res.status(200).send(result);
      } catch (error) {
        console.log("FOOD_GET", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.get("/foods/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { sellerEmail: email };

        const result = await foodsCollection.find(query).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.log("FOOD_EMAIL_GET", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.get("/foods/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await foodsCollection.findOne(query, {});

        res.status(200).send(result);
      } catch (error) {
        console.log("FOOD_ID_GET", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.get("/count/foods", async (req, res) => {
      try {
        const result = await foodsCollection.countDocuments({});
        res.status(200).send({ count: result });
      } catch (error) {
        console.log("FOOD_COUNT_GET", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.get("/top/foods", async (req, res) => {
      try {
        const result = await foodsCollection
          .find()
          .sort({ orderCount: -1 })
          .limit(6)
          .toArray();
        console.log(result);
        res.status(200).send(result);
      } catch (error) {
        console.log("FOOD_TOP_GET", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.post("/foods", async (req, res) => {
      try {
        const newFood = req.body;
        const result = await foodsCollection.insertOne(newFood);
        res.status(201).send(result);
      } catch (error) {
        console.log("FOOD_POST", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.patch("/foods/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const filter = { _id: new ObjectId(id) };
        const updatedFood = {
          $set: req.body,
        };
        const options = { upsert: false };

        const result = await foodsCollection.updateOne(
          filter,
          updatedFood,
          options
        );
        console.log("Updated food", result);
        res.status(200).send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.delete("/foods/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await foodsCollection.deleteOne(query);
        res.status(204).send(result);
      } catch (error) {
        console.log("FOOD_DELETE", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    // Order collection
    const ordersCollection = db.collection("orders");

    app.get("/orders", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { buyerEmail: email };

        const result = await ordersCollection.find(query).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.log("ORDER_GET", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.post("/orders", async (req, res) => {
      try {
        const newOrder = req.body;

        // extract quantity from order
        const quantity = parseInt(newOrder.quantity);
        const foodId = newOrder.foodId;

        const filter = { _id: new ObjectId(foodId) };

        // get the food
        const food = await foodsCollection.findOne(filter, {});

        // check if buyer is not seller
        if (food.sellerEmail === newOrder.buyerEmail)
          return res
            .status(400)
            .send({ message: "You cannot buy your own food" });

        // check if food quantity is enough
        if (food.quantity < quantity)
          return res.status(400).send({ message: "Not enough food" });

        // update food quantity
        const updatedFood = {
          $inc: { quantity: -quantity, orderCount: food.orderCount + 1 },
        };
        const options = { upsert: false };
        await foodsCollection.updateOne(filter, updatedFood, options);

        const result = await ordersCollection.insertOne(newOrder);
        res.status(201).send(result);
      } catch (error) {
        console.log("ORDER_POST", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    app.delete("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await ordersCollection.deleteOne(query);
        res.status(204).send(result);
      } catch (error) {
        console.log("ORDER_DELETE", error);
        res.status(500).send({ message: "Internal error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`App listening on port ${port}!`);
});
