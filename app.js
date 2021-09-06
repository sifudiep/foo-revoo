const express = require("express");
const bcrypt = require("bcryptjs")
const session = require("express-session")
const expressHandlebars = require("express-handlebars")
const app = express();
const SQLiteStore = require("connect-sqlite3")(session);

const sqllite3 = require("sqlite3")
const db = new sqllite3.Database("storage/database.db")

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
app.use(express.urlencoded({
    extended: false
}));
app.use(session({
    store: new SQLiteStore({
        db: "storage/database.db",
        table: "Session"
    }),
    saveUninitialized: false,
    resave: false,
    secret: 'dg$##SK123LE',
    cookie: {
        maxAge: 180 * 60 * 1000
    }
}))

app.engine('hbs', expressHandlebars({
    extname: ".hbs",
    defaultLayout: "primary-layout.hbs"
}))

app.use(express.static("public"))

app.get("/", (req, res) => {
    res.render("home.hbs", {})
    console.log(`req.session.id : ${req.session.id}`);

})

app.get("/about", (req, res) => {
    res.render("about.hbs", {})
    console.log(`req.session.id : ${req.session.id}`);
})

app.get("/contact", (req, res) => {
    res.render("contact.hbs", {})
})

app.get("/restaurant-review", (req, res) => {
    res.render("restaurant-review.hbs")
})

app.get("/all-reviews", (req, res) => {
    res.render("all-reviews.hbs", {
        allRestaurants
    })
})

app.get("/add-reviews", (req, res) => {
    if (req.session.isAuth) {
        res.render("add-reviews.hbs")
    } else {
        res.redirect("./access-denied")
    }
})

app.get("/edit-reviews", (req, res) => {
    if (req.session.isAuth) {
        updateAllRestaurants();
        res.render("edit-reviews.hbs", {
            allRestaurants
        })
    } else {
        res.redirect("./access-denied")
    }

})

app.get("/delete-reviews", (req, res) => {
    if (req.session.isAuth) {
        updateAllRestaurants();
        res.render("delete-reviews.hbs", {
            allRestaurants
        });
    } else {
        res.redirect("./access-denied");
    }

})

app.get("/access-denied", (req, res) => {
    res.render("access-denied.hbs")
})

app.get("/login", (req, res) => {
    res.render("login.hbs", {});
})

// GET REQUESTS after this does not work since app.js renders error.hbs to them instead.
app.get("/:id", (req, res) => {
    updateAllRestaurants();
    let targetRestaurant = undefined;

    for (let i = 0; i < allRestaurants.length; i++) {
        if (allRestaurants[i].Id == req.params.id) {
            targetRestaurant = allRestaurants[i];
        }
    }

    if (targetRestaurant === undefined) {
        res.render("error.hbs");
    } else {
        res.render("restaurant-review.hbs", {
            targetRestaurant
        })
    }
})

// Add counter to user to lock account, so you can't have infinite login attempts to account.
app.post("/login", (req, res) => {
    db.get("SELECT * FROM USER WHERE Email = ?", [req.body.Email], async (err, user) => {
        if (err) console.log(err);
        else {
            if (user) {
                const isMatch = await bcrypt.compare(req.body.Password, user.Password);
                if (isMatch) {
                    req.session.isAuth = true;
                    console.log(req.session);
                }
            }
            res.redirect("./")
        }
    })
})

app.post("/delete-review", (req, res) => {
    if (req.session.isAuth) {
        console.log(`posted to delete-review...`);
        for (let i = 0; i < allRestaurants.length; i++) {
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
    } else {
        res.redirect("access-denied");
    }
})

app.post("/update-review", (req, res) => {
    if (req.session.isAuth) {
        for (let i = 0; i < allRestaurants.length; i++) {
            if (allRestaurants[i].Id == req.body.Id) {
                console.log(`updating review for ${req.body.Name}`);
                db.run(`UPDATE Restaurant SET Name = ?, Score = ?, Review = ?, City = ?, Address = ?, ImageLink = ? WHERE Id = ?`, [req.body.Name, req.body.Score, req.body.Review, req.body.City, req.body.Address, req.body.ImageLink, req.body.Id], (error) => {
                    if (error) console.log(error);
                    else {
                        console.log(`Updated row with Id : ${req.body.Id} and Name : ${req.body.Name}`);
                    }
                })
            }
        }

        updateAllRestaurants();
        res.redirect("edit-reviews");
    } else {
        res.redirect("access-denied");
    }
})

app.post("/add-review", (req, res) => {
    if (req.session.isAuth) {
        db.run(`INSERT INTO Restaurant (Name, Score, Review, ImageLink, City, Address) VALUES (?, ?, ?, ?, ?, ?) `, [req.body.Name, req.body.Score, req.body.Review, req.body.ImageLink, req.body.City, req.body.Address], (error) => {
            if (error) console.log(error);
            else {
                console.log(`Successfully inserted a row into Restaurant!`);
            }

        });

        updateAllRestaurants();
        res.redirect("add-reviews");
    } else {
        res.redirect("access-denied");
    }
});

app.listen(3000, () => {
    console.log("listening on 3000...")
});