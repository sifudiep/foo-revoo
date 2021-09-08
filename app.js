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
const port = 3000;
const threeHoursInMilliseconds = 3 * 60 * 60 * 1000;

function updateAllRestaurants() {
    db.all("SELECT * FROM Restaurant", (error, restaurants) => {
        if (error) throw error;
        else {
            allRestaurants = restaurants;
        }
    })
}

// Checks authentication from database instead of req.session, should be better for memory leaks?
function checkAuthentication(session) {
    let authenticated = false;
    let dbQueryFinished = false;
    db.get("SELECT * FROM Session WHERE sid = ?", [session.id], (error, result) => {
        if (error) throw error;
        else {
            if (result) {
                let sess = JSON.parse(result.sess)
                if (sess.isAuth) {
                    console.log(this);
                    authenticated = true;
                    dbQueryFinished = true;
                } 
                console.log(`Finished with db request.`);
            }
        }
    })
}

function removeOldSessions() {
    db.all("SELECT * FROM Session", (error, allSessions) => {
        if (error) throw error
        else {
            for (let i = 0; i < allSessions.length; i++) {
                let sess = JSON.parse(allSessions[i].sess);
                let expiry = new Date(sess.cookie.expires);
                let now = new Date(Date.now());
                if (now > expiry) {
                    db.run("DELETE FROM Session WHERE sid = ?", [allSessions[i].sid], (error) => {
                        if (error) throw error;
                        else {
                            console.log(`Deleted session with sid : ${allSessions[i].sid}`);
                        }
                    })
                }
            }
        }
    });
}

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
        maxAge: threeHoursInMilliseconds
    }
}))


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
    const page = parseInt(req.query.page);
    
    res.render("all-reviews.hbs", {
        restaurant : allRestaurants[page]
    })
})

app.get("/add-reviews", (req, res) => {
    if (checkAuthentication(req.session) === false) {
        res.redirect("/access-denied");
        return;
    }

    res.render("add-reviews.hbs")
})

app.get("/edit-reviews", (req, res) => {
    if (checkAuthentication(req.session) === false) {
        res.redirect("/access-denied");
        return;
    }

    updateAllRestaurants();
    res.render("edit-reviews.hbs", {
        allRestaurants
    })
})

app.get("/delete-reviews", (req, res) => {
    if (checkAuthentication(req.session) === false) {
        res.redirect("/access-denied")
        return;
    };

    updateAllRestaurants();
    res.render("delete-reviews.hbs", {
        allRestaurants
    });
})

app.get("/access-denied", (req, res) => {
    res.render("access-denied.hbs")
})

app.get("/login", (req, res) => {
    res.render("login.hbs", {});
})


// Add counter to user to lock account, so you can't have infinite login attempts to account.
app.post("/login", (req, res) => {
    db.get("SELECT * FROM USER WHERE Email = ?", [req.body.Email], async (error, user) => {
        if (error) throw error;
        else {
            if (user) {
                const isMatch = await bcrypt.compare(req.body.Password, user.Password);
                if (isMatch) {
                    req.session.isAuth = true;
                    console.log(`succesfully logged in!`);
                }
            }
            res.redirect("./")
        }
    })
})

app.post("/delete-review", (req, res) => {
    if (checkAuthentication(req.session) == false) {
        res.redirect("/access-denied");
        return;
    }

    for (let i = 0; i < allRestaurants.length; i++) {
        if (allRestaurants[i].Id == req.body.Id) {
            db.run(`DELETE FROM Restaurant WHERE Id = ?`, [req.body.Id], (error) => {
                if (error) throw error;
                else {
                    console.log(`Deleted row with Id : ${req.body.Id} and Name : ${req.body.Name}`);
                }
            })
        }
    }

    updateAllRestaurants();
    res.redirect("delete-reviews")
})

app.post("/update-review", (req, res) => {
    if (checkAuthentication(req.session) == false) {
        res.redirect("/access-denied");
        return;
    }

    for (let i = 0; i < allRestaurants.length; i++) {
        if (allRestaurants[i].Id == req.body.Id) {
            console.log(`updating review for ${req.body.Name}`);
            db.run(`UPDATE Restaurant SET Name = ?, Score = ?, Review = ?, City = ?, Address = ?, ImageLink = ? WHERE Id = ?`, [req.body.Name, req.body.Score, req.body.Review, req.body.City, req.body.Address, req.body.ImageLink, req.body.Id], (error) => {
                if (error) throw error;
                else {
                    console.log(`Updated row with Id : ${req.body.Id} and Name : ${req.body.Name}`);
                }
            })
        }
    }

    updateAllRestaurants();
    res.redirect("edit-reviews");
})

app.post("/add-review", (req, res) => {
    if (checkAuthentication(req.session) == false) {
        res.redirect("/access-denied");
        return; 
    }

    db.run(`INSERT INTO Restaurant (Name, Score, Review, ImageLink, City, Address) VALUES (?, ?, ?, ?, ?, ?) `, [req.body.Name, req.body.Score, req.body.Review, req.body.ImageLink, req.body.City, req.body.Address], (error) => {
        if (error) throw error;
        else {
            console.log(`Successfully inserted a row into Restaurant!`);
        }

    });

    updateAllRestaurants();
    res.redirect("add-reviews");
});

app.listen(port, () => {
    console.log("listening on port " + port)
    setInterval(removeOldSessions, threeHoursInMilliseconds);
    updateAllRestaurants();
});

