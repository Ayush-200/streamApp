import mongoose from 'mongoose';

const connectDB = async () => {

    try {

        await mongoose.connect("mongodb+srv://ayushbhatia456:Ayushbhatia123@cluster0.denecxq.mongodb.net/?appName=Cluster0", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        // console.log("mongo uri is ", process.env.MONGO_URI);
        console.log("mongodb connected!", mongoose.connection.name);
         console.log("Cluster host:", conn.connection.host); // cluster host
    console.log("Cluster port:", conn.connection.port); // usually 27017 for Atlas
    console.log("Database name:", conn.connection.name); // database you are connected to
    console.log("Client info:", conn.connection.client.s.options.srvHost); // Atlas cluster URL
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections in DB:", collections.map(c => c.name));
    }
    catch (error) {
        console.log("error occured in db.js", error);
    }
}
export default connectDB; 