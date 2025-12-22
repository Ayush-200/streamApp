import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Assign the connection to a variable
    const conn = await mongoose.connect(
      "mongodb+srv://ayushbhatia456:ayushbhatia123@cluster0.denecxq.mongodb.net/yourDBName?retryWrites=true&w=majority",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log("MongoDB connected!");
    console.log("Cluster host:", conn.connection.host); // cluster host
    console.log("Cluster port:", conn.connection.port); // usually 27017
    console.log("Database name:", conn.connection.name); // database name
    console.log("Client info:", conn.connection.client.s.options.srvHost); // Atlas cluster URL

    // List all collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log("Collections in DB:", collections.map(c => c.name));

  } catch (error) {
    console.error("Error occurred in db.js", error);
  }
};

export default connectDB;
