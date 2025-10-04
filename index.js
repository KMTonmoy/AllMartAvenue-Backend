const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: ["http://localhost:3000", "https://allmartavenue.vercel.app"],
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
    const productsCollection = client.db("allmart").collection("products");

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


    app.get("/products/search", async (req, res) => {
      try {
        const { q } = req.query;

        if (!q) {
          return res.status(400).send({ error: "Search query is required" });
        }

        const searchQuery = {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
            { details: { $regex: q, $options: "i" } },
            { category: { $regex: q, $options: "i" } },
            { productTag: { $regex: q, $options: "i" } },
            { "colors.name": { $regex: q, $options: "i" } },
            { features: { $regex: q, $options: "i" } }
          ]
        };

        const products = await productsCollection.find(searchQuery).toArray();
        res.send(products);
      } catch (error) {
        console.error("Error searching products:", error);
        res.status(500).send({ error: "Failed to search products" });
      }
    });

    // Get all products
    app.get("/products", async (req, res) => {
      try {
        const products = await productsCollection.find().toArray();
        res.send(products);
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send({ error: "Failed to fetch products" });
      }
    });

    // Get product by ID
    app.get("/products/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid product ID" });
        }

        const query = { _id: new ObjectId(id) };
        const product = await productsCollection.findOne(query);

        if (!product) {
          return res.status(404).send({ error: "Product not found" });
        }

        res.send(product);
      } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).send({ error: "Failed to fetch product" });
      }
    });

    // Create new product
    app.post("/products", async (req, res) => {
      try {
        const product = req.body;

        if (!product.name || !product.price || !product.category) {
          return res.status(400).send({ error: "Missing required fields: name, price, category" });
        }

        const result = await productsCollection.insertOne({
          ...product,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        res.status(201).send({
          message: "Product created successfully",
          productId: result.insertedId
        });
      } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).send({ error: "Failed to create product" });
      }
    });

    // Update product by ID
    app.put("/products/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const product = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid product ID" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            ...product,
            updatedAt: new Date()
          }
        };

        const result = await productsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Product not found" });
        }

        res.send({ message: "Product updated successfully", result });
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send({ error: "Failed to update product" });
      }
    });

    // Delete product by ID
    app.delete("/products/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid product ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await productsCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ error: "Product not found" });
        }

        res.send({ message: "Product deleted successfully" });
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).send({ error: "Failed to delete product" });
      }
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
  res.send("AllMart Server is Runing 🏃‍➡️🏃‍➡️🏃‍➡️");
});
