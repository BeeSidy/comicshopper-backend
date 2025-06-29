require("dotenv").config();

const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

app.use(express.json());
app.use(cors());

// Database Connection With MongoDB
mongoose.connect(process.env.MONGO_URL);

// API Creation

app.get("/",(req,res)=>{
    res.send("Express App is Running")
})

// Image Storage Engine

const storage = multer.diskStorage({
    destination:'./upload/images',
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})

// Creating Upload Endpoint for images

app.use('/images',express.static('upload/images'))

app.post("/upload",upload.single('product'),(req,res)=>{
    res.json({
        success:1,
        image_url:`http://localhost:${port}/images/${req.file.filename}`
    })
})

// Schema for Creating Products

const Product = mongoose.model("Product",{
    id:{
        type: Number,
        required:true,
    },
    name:{
        type:String,
        required:true,
    },
    image:{
        type:String,
        required:true,
    },
    category:{
        type:String,
        required:true,
    },
    new_price:{
        type:Number,
        required:true
    },
    old_price:{
        type:Number,
        required:true,
    },
    description: { 
        type: String,
        required:true,
    },
    author: {
        type: String,
        required:true,
    },
    date:{
        type:Date,
        default:Date.now,
    },
    avilable:{
        type:Boolean,
        default:true,
    },
})

app.post('/addproduct',async (req,res)=>{
    let products = await Product.find({});
    let id;
    if(products.length>0)
    {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id+1;
    }
    else{
        id=1;
    }
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,
        description:req.body.description,
        author:req.body.author,
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})

// Creating API for deleting Products

app.post('/removeproduct',async (req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name:req.body.name
    })
})

// Creating API for getting all products
app.get('/allproducts',async (req,res)=>{
    let products = await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
})

// Shema creating for User model
const Users = mongoose.model('Users',{
    name:{
        type:String,    
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date,
        default:Date.now,
    }
})

// Creating Endpoint for registering the user
app.post('/signup',async(req,res)=>{ 

    let check = await Users.findOne({email:req.body.email});
    if (check) {
        return res.status(400).json({success:false,errors:"Знайдено існуючого користувача з такою ж електронною адресою"})
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i]=0;
    }
    const user = new Users({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })

    await user.save();

    const data = {
        user:{
            id:user.id
        }
    }

    const token = jwt.sign(data,'secret_ecom');
    res.json({success:true,token})

})

// Creating endpoint for user login
app.post('/login',async (req,res)=>{
    let user = await Users.findOne({email:req.body.email});
    if (user) {
        const passCompare =req.body.password === user.password;
        if (passCompare) {
            const data = {
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true,token});
        }
        else{
            res.json({success:false,errors:"Невірний пароль"});
        }
    }
    else{
        res.json({success:false,errors:"Невірний ідентифікатор електронної пошти"})
    }
})

// Creating endpoint for newcollection data
app.get('/newcollections',async (req,res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("NewCollection Fetched");
    res.send(newcollection);
})

// Creating endpoint for Related Products
app.get('/relatedproducts',async (req,res)=>{
    let products = await Product.find({});
    let relatedproducts = products.slice(1).slice(-4);
    console.log("RelatedProducts Fetched");
    res.send(relatedproducts);
})

// Creating endpoint for popular in women section
app.get('/popularindc',async (req,res)=>{
    let products = await Product.find({category:"dc"})
    let popular_in_women = products.slice(0,4);
    console.log("Popular in dc fetched")
    res.send(popular_in_women);
})

// Creating middelware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        res.status(401).send({errors: "Please authenticate using valid token"});
    } else {
        try {
            const data = jwt.verify(token, 'secret_ecom');
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({errors: "Please authenticate using a valid token"});
        }
    }
};

// Creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser,async(req,res)=>{
    console.log("Added",req.body.itemId)
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Added")
})


// Creating endpoint to remove product from cartdata
app.post('/removefromcart',fetchUser,async (req,res)=>{
    console.log("removed",req.body.itemId)
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Removed")
})

// Creating endpoint to get cartdata
app.post('/getcart',fetchUser,async (req,res)=>{
    console.log("GetCart");
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

// Добавление роута для обновления корзины на сервере
app.post('/updatecart', fetchUser, async (req, res) => {
    console.log("Updating Cart on Server");
    let userData = await Users.findOne({ _id: req.user.id });
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: req.body.cart });
    res.send("Cart Updated Successfully");
  });
  

const nodemailer = require('nodemailer');

// Настройка транспортера для отправки писем через Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'comicshopper794@gmail.com', // Ваша почта Gmail
        pass: 'pcoyyyhqfsrnntda'   // Пароль от вашей почты Gmail
    }
});

const sendFeedbackEmail = (name, userEmail, message) => {
    const mailOptions = {
        from: userEmail,
        to: 'comicshopper794@gmail.com', // Ваша почта Gmail для получения сообщений
        subject: `Повідомлення від ${name}`,
        text: Вітаю
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Email sent: ' + info.response);
    });
};


app.post('/sendfeedback', (req, res) => {
    const { name, email, message } = req.body;

    sendFeedbackEmail(name, email, message);

    res.json({ success: true, message: 'Feedback sent successfully!' });
});


// Функция отправки уведомления о заказе
const sendOrderConfirmationEmail = (orderData) => {
    const mailOptions = {
        from: 'comicshopper794@gmail.com',
        to: orderData.email,
        subject: 'Підтвердження замовлення',
        html: `
            <h1>Дякуємо за ваше замовлення!</h1>
            <p>Шановний(а) ${orderData.name}, ваше замовлення було успішно оформлено.</p>
            <h2>Деталі замовлення:</h2>
            <ul>
                ${orderData.items.map(item => `
                    <li>
                        <strong>${item.name}</strong>
                        <ul>
                            <li>Ціна: ${item.price} грн</li>
                            <li>Кількість: ${item.quantity}</li>
                        </ul>
                    </li>
                `).join('')}
            </ul>
            <p>Загальна сума до оплати: ${orderData.total} грн</p>
            <p>Дякуємо, що обрали нас!</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Помилка при відправці електронної пошти:', error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};

const Order = mongoose.model('Order', {
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    items: { type: Array, required: true },
    total: { type: Number, required: true },
    status: { type: String, default: 'pending' }
});

// Маршрут для получения всех заказов
app.get('/api/admin/orders', async (req, res) => {
    const orders = await Order.find({});
    res.json(orders);
});

// Маршрут для подтверждения заказа
app.post('/api/admin/orders/confirm', async (req, res) => {
    const { orderId } = req.body;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Замовлення не знайдено' });
        }

        // Меняем статус заказа на подтвержденный
        order.status = 'confirmed';
        await order.save();

        // Отправляем уведомление о подтверждении заказа
        sendOrderConfirmationEmail({
            name: order.name,
            email: order.email,
            items: order.items,
            total: order.total
        });

        res.json({ success: true, message: 'Замовлення успішно підтверджено' });
    } catch (error) {
        console.error('Помилка при підтвердженні замовлення:', error);
        res.status(500).json({ success: false, message: 'Щось пішло не так' });
    }
});

// Маршрут для удаления заказа
app.post('/api/admin/orders/delete', async (req, res) => {
    const { orderId } = req.body;
    await Order.findByIdAndDelete(orderId);
    res.json({ success: true });
});



app.post('/order', async (req, res) => {
    const { name, email, address, city, phoneNumber, items, total } = req.body;

    const order = new Order({ name, email, address, city, phoneNumber, items, total });
    await order.save();

    res.json({ success: true, message: 'Замовлення оформлено успішно!' });
});



app.listen(port,(error)=>{
    if (!error) {
        console.log("Server Running on Port "+port) 
    }
    else
    {
        console.log("Error : "+error)
    }
})
