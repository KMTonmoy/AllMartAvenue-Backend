const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");

const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: ["http://localhost:3000", "https://waygobustravels.vercel.app"],
    credentials: true,
  })
);

app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log("Connected to MongoDB");
    

    const bannerCollection = client.db("allmart").collection("BannerCollection");
    const usersCollection = client.db("allmart").collection("users");
    const couponsCollection = client.db("allmart").collection("coupons");

    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.patch("/users/:email", async (req, res) => {
      const { email } = req.params;
      const { role, ids, userEmail, userName } = req.body;

      const filter = { email: email };
      const updateDoc = {
        $set: {
          role,
          userEmail,
          userName,
        },
      };

      try {
        const result = await usersCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "User not found" });
        }

        if (result.modifiedCount === 0) {
          return res
            .status(400)
            .send({ message: "No changes made to the user" });
        }

        res.send({ message: "User updated successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to update user" });
      }
    });

    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email, name: user.displayName };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user.status === "Requested") {
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status },
          });
          return res.send(result);
        } else {
          return res.send(isExist);
        }
      }

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.get("/banners", async (req, res) => {
      try {
        const banners = await bannerCollection.find().toArray();
        res.send(banners);
      } catch (error) {
        console.error("Error fetching banners:", error);
        res.status(500).send({ error: "Failed to fetch banners" });
      }
    });

    app.post("/banners", async (req, res) => {
      const banner = req.body;

      if (!banner || !banner.url || !banner.heading || !banner.description) {
        return res.status(400).send({ error: "Invalid banner data" });
      }

      try {
        const result = await bannerCollection.insertOne({
          url: banner.url,
          heading: banner.heading,
          description: banner.description,
          timestamp: Date.now(),
        });
        res
          .status(201)
          .send({ message: "Banner uploaded successfully", result });
      } catch (error) {
        console.error("Error uploading banner:", error);
        res.status(500).send({ error: "Failed to upload banner" });
      }
    });

    app.patch("/banners/:id", async (req, res) => {
      const id = req.params.id;
      const { url, heading, description } = req.body;

      if (!url && !heading && !description) {
        return res.status(400).send({ error: "No fields provided for update" });
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...(url && { url }),
          ...(heading && { heading }),
          ...(description && { description }),
        },
      };

      try {
        const result = await bannerCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Banner not found" });
        }

        res.send({ message: "Banner updated successfully", result });
      } catch (error) {
        console.error("Error updating banner:", error);
        res.status(500).send({ error: "Failed to update banner" });
      }
    });

    app.put("/banners/:id", async (req, res) => {
      const id = req.params.id;
      const { url, heading, description } = req.body;

      if (!url && !heading && !description) {
        return res.status(400).send({ error: "No fields provided for update" });
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...(url && { url }),
          ...(heading && { heading }),
          ...(description && { description }),
        },
      };

      try {
        const result = await bannerCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Banner not found" });
        }

        res.send({ message: "Banner updated successfully", result });
      } catch (error) {
        console.error("Error updating banner:", error);
        res.status(500).send({ error: "Failed to update banner" });
      }
    });

    app.get("/coupons", async (req, res) => {
      const coupons = await couponsCollection.find().toArray();
      res.send(coupons);
    });

    app.patch("/coupons/:id", async (req, res) => {
      const { id } = req.params;
      const coupon = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          code: coupon.code,
          discount: coupon.discount,
          description: coupon.description,
        },
      };
      try {
        const result = await couponsCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Coupon not found" });
        }
        res.send({ acknowledged: true });
      } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).send({ message: "Failed to update coupon" });
      }
    });

    app.post("/coupons", async (req, res) => {
      const coupon = req.body;
      const result = await couponsCollection.insertOne(coupon);
      res.send(result);
    });

    app.delete("/coupons/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await couponsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/coupons/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const coupon = await couponsCollection.findOne(query);
      res.send(coupon);
    });

    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } finally {
    process.on("SIGINT", async () => {});
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("WayGo is sitting");
});
