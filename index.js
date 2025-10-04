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


    const ordersCollection = client.db("allmart").collection("orders");

    // Order Endpoints

    // Create new order
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;

        // Validation
        if (!order.customerInfo || !order.items || !order.items.length) {
          return res.status(400).send({
            error: "Missing required fields: customerInfo and items are required"
          });
        }

        if (!order.grandTotal || order.grandTotal <= 0) {
          return res.status(400).send({
            error: "Invalid grand total"
          });
        }

        const result = await ordersCollection.insertOne({
          ...order,
          status: "pending", // Default status
          createdAt: new Date(),
          updatedAt: new Date()
        });

        res.status(201).send({
          message: "Order created successfully",
          orderId: result.insertedId,
          orderNumber: order.orderNumber
        });
      } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).send({ error: "Failed to create order" });
      }
    });

    // Get all orders
    app.get("/orders", async (req, res) => {
      try {
        const { status, customerPhone } = req.query;
        let query = {};

        // Filter by status if provided
        if (status) {
          query.status = status;
        }

        // Filter by customer phone if provided
        if (customerPhone) {
          query["customerInfo.phone"] = customerPhone;
        }

        const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
        res.send(orders);
      } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send({ error: "Failed to fetch orders" });
      }
    });

    // Get order by ID
    app.get("/orders/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid order ID" });
        }

        const query = { _id: new ObjectId(id) };
        const order = await ordersCollection.findOne(query);

        if (!order) {
          return res.status(404).send({ error: "Order not found" });
        }

        res.send(order);
      } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).send({ error: "Failed to fetch order" });
      }
    });

    // Get orders by customer phone
    app.get("/orders/customer/:phone", async (req, res) => {
      try {
        const { phone } = req.params;

        const orders = await ordersCollection.find({
          "customerInfo.phone": phone
        }).sort({ createdAt: -1 }).toArray();

        res.send(orders);
      } catch (error) {
        console.error("Error fetching customer orders:", error);
        res.status(500).send({ error: "Failed to fetch customer orders" });
      }
    });

    // Update order status - Single endpoint for all status updates
    app.patch("/orders/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status, trackingNumber, returnReason } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid order ID" });
        }

        const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];
        if (!status || !validStatuses.includes(status)) {
          return res.status(400).send({
            error: "Invalid status. Must be one of: pending, confirmed, shipped, delivered, cancelled, returned"
          });
        }

        const filter = { _id: new ObjectId(id) };
        const updateData = {
          status: status,
          updatedAt: new Date()
        };

         if (status === "shipped") {
          updateData.shippedAt = new Date();
          if (trackingNumber) {
            updateData.trackingNumber = trackingNumber;
          }
        }

        if (status === "delivered") {
          updateData.deliveredAt = new Date();
        }

        if (status === "returned" && returnReason) {
          updateData.returnReason = returnReason;
          updateData.returnedAt = new Date();
        }

        if (status === "cancelled") {
          updateData.cancelledAt = new Date();
        }

        const updateDoc = {
          $set: updateData
        };

        const result = await ordersCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Order not found" });
        }

        res.send({
          message: `Order status updated to ${status} successfully`,
          result
        });
      } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).send({ error: "Failed to update order status" });
      }
    });

    // Delete order
    app.delete("/orders/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid order ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await ordersCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ error: "Order not found" });
        }

        res.send({ message: "Order deleted successfully" });
      } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).send({ error: "Failed to delete order" });
      }
    });

    // Get order statistics
    app.get("/orders-stats", async (req, res) => {
      try {
        const totalOrders = await ordersCollection.countDocuments();
        const pendingOrders = await ordersCollection.countDocuments({ status: "pending" });
        const confirmedOrders = await ordersCollection.countDocuments({ status: "confirmed" });
        const shippedOrders = await ordersCollection.countDocuments({ status: "shipped" });
        const deliveredOrders = await ordersCollection.countDocuments({ status: "delivered" });
        const cancelledOrders = await ordersCollection.countDocuments({ status: "cancelled" });
        const returnedOrders = await ordersCollection.countDocuments({ status: "returned" });

        const totalRevenue = await ordersCollection.aggregate([
          { $match: { status: "delivered" } },
          { $group: { _id: null, total: { $sum: "$grandTotal" } } }
        ]).toArray();

        res.send({
          totalOrders,
          pendingOrders,
          confirmedOrders,
          shippedOrders,
          deliveredOrders,
          cancelledOrders,
          returnedOrders,
          totalRevenue: totalRevenue[0]?.total || 0
        });
      } catch (error) {
        console.error("Error fetching order statistics:", error);
        res.status(500).send({ error: "Failed to fetch order statistics" });
      }
    });



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
