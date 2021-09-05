const express = require('express');
const expressHandlebars = require('express-handlebars')
const app = express();

const sqllite3 = require("sqlite3")
const db = new sqllite3.Database('storage/database.db')

// MODEL ATTRIBUTES ORDER - 
// Name, Score, Review, Location, ImageLink

let allRestaurants;


function updateAllRestaurants() {
    db.all("SELECT * FROM Restaurant", (error, restaurants) => {
        if (error) console.log(error);
        else { 
            allRestaurants = restaurants;
        }
    })
}

updateAllRestaurants();




// HANDLER
app.use(express.urlencoded({extended: false}));



app.engine('hbs', expressHandlebars({
    extname: ".hbs",
    defaultLayout: "primary-layout.hbs"
}))

app.use(express.static("public"))

app.get("/", (req, res) => {
    res.render("home.hbs", {})
})

app.get("/about", (req, res) => {
    res.render("about.hbs", {})
})

app.get("/contact", (req, res) => {
    res.render("contact.hbs", {})
})

app.get("/restaurant-review", (req, res) => {
    res.render("restaurant-review.hbs")
})

app.get("/all-reviews", (req, res) => {
    res.render("all-reviews.hbs", {allRestaurants})
})

app.get("/add-reviews", (req,res) => {
    res.render("add-reviews.hbs")
})

app.get("/edit-reviews", (req, res) => {
    updateAllRestaurants();
    res.render("edit-reviews.hbs", {allRestaurants})
})

app.get("/delete-reviews", (req, res) => {
    updateAllRestaurants();
    res.render("delete-reviews.hbs", {allRestaurants});
})

app.post("/delete-review", (req, res) => {
    console.log(`posted to delete-review...`);
    for (var i = 0; i < allRestaurants.length; i++) {
        if (allRestaurants[i].Id == req.body.Id) {
            db.run(`DELETE From Restaurant WHERE Id = ?`, [req.body.Id], (error) => {
                if (error) console.log(error);
                else {
                    console.log(`Deleted row with Id : ${req.body.Id} and Name : ${req.body.Name}`);
                }
            })
        }
    }

    updateAllRestaurants();
    res.redirect("delete-reviews")
})

app.post("/update-review", (req,res) => {
    for (var i = 0; i < allRestaurants.length; i++) {
        if (allRestaurants[i].Id == req.body.Id) {
            console.log(`updating review for ${req.body.Name}`);
            db.run(`UPDATE Restaurant SET NAME = ?, Score = ?, Review = ?, Location = ?, ImageLink = ? WHERE Id = ?`, [req.body.Name, req.body.Score, req.body.Review, req.body.Location, req.body.ImageLink, req.body.Id], (error) => {
                if (error) console.log(error);
                else {
                    console.log(`Updated row with Id : ${req.body.Id} and Name : ${req.body.Name}`);
                }
            })
        }
    }

    updateAllRestaurants();
    res.redirect("edit-reviews")
})

app.post("/add-review", (req,res) => {
    db.run(`INSERT INTO Restaurant (Name, Score, Review, Location, ImageLink) VALUES (?, ?, ?, ?, ?) `, [req.body.Name, req.body.Score, req.body.Review, req.body.Location, req.body.ImageLink], (error) => {
        if (error) console.log(error);
        else {
            console.log(`Successfully inserted a row into Restaurant!`);
        }

    });
    
    updateAllRestaurants();
    res.redirect("add-reviews");
});

app.listen(3000, () => {
    console.log("listening on 3000...")
});