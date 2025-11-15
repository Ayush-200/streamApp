import mongoose from 'mongoose';

const connectDB = async () => {

    try {

        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        // console.log("mongo uri is ", process.env.MONGO_URI);
        console.log("mongodb connected!", mongoose.connection.name);
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections in DB:", collections.map(c => c.name));
    }
    catch (error) {
        console.log("error occured in db.js", error);
    }
}
export default connectDB; 