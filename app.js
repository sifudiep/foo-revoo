const express = require('express');
const expressHandlebars = require('express-handlebars')

const app = express();

const restaurants = {
    aqua: {
        name : "Aqua Dinner & Drinks", 
        reviewText : "Tis pretty good for it's price, innit. Furthermore I do like me some swedish meatballs. I also happen to like schnitzel. This is not an attempt to make the text longer for development purposement... no that would be innaproppiate.", 
        imgLink : "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fplacesoaf.com%2Fyer%2Faqua-dinner-drinks-772941.jpg&f=1&nofb=1",
        location : "24 Barnarpsgatan, Jönköping",
        score : 8
        
    }
}


app.engine('hbs', expressHandlebars({
    extname: ".hbs",
    defaultLayout: "primary-layout.hbs"
}))

app.get("/home", (req, res) => {
    res.render("home.hbs", {})
})

app.get("/about", (req, res) => {
    res.render("about.hbs", {})
})

app.get("/contact", (req, res) => {
    res.render("contact.hbs", {})
})

app.get("/restaurant-review", (req, res) => {
    res.render("restaurant-review.hbs", restaurants.aqua)
})

app.get("/style.css", (req,res) => {
    res.sendFile(__dirname + "/style.css")
})

app.listen(3000, () => {
    console.log("listening on 3000...")
});