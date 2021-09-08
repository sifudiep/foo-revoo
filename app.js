const express = require("express");
const bcrypt = require("bcryptjs");
const expressHandlebars = require("express-handlebars");
const app = express();

const session = require("express-session");
const sqliteStore = require("better-sqlite3-session-store")(session);

const db = require("better-sqlite3")('storage/database.db', {
    fileMustExist: true
});

// MODEL ATTRIBUTES ORDER - 
// Name, Score, Review, Location, ImageLink

let allRestaurants;
const port = 3000;
const threeHoursInMilliseconds = 3 * 60 * 60 * 1000;

function updateAllRestaurants() {
    allRestaurants = db.prepare("SELECT * FROM restaurants").all();
}

// Checks authentication from database instead of req.session, should be better for memory leaks?
function checkAuthentication(sessionId) {
    const row = db.prepare("SELECT * FROM sessions WHERE sid = ?").get(sessionId);
    if (row) {
        let sess = JSON.parse(row.sess);
        if (sess.isAuth) return true;
    } 
    return false;
}

function removeOldSessions() {
    const allSessions = db.prepare("SELECT * FROM sessions").all();

    if (!allSessions) return false;

    for (let i = 0; i < allSessions.length; i++) {
        let sess = JSON.parse(allSessions[i].sess);
        let expiry = new Date(sess.cookie.expires);
        let now = new Date(Date.now());
        if (now > expiry) {
            db.prepare("DELETE FROM sessions WHERE sid = ?").run(allSessions[i].id);
        }
    }

}

// HANDLER
app.use(express.urlencoded({
    extended: false
}));
app.use(session({
    store: new sqliteStore({
        client: db
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
    console.log(`checkAuthentication : `);
    console.log(checkAuthentication(req.sessionID));
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    res.render("add-reviews.hbs")
})

app.get("/edit-reviews", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    updateAllRestaurants();
    res.render("edit-reviews.hbs", {
        allRestaurants
    })
})

app.get("/delete-reviews", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
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
app.post("/login", async (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(req.body.email);
    if (user) {
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (isMatch) {
            req.session.isAuth = true;
            console.log(`succesfully logged in!`);
            res.redirect("./")
        }
    }
    
})

app.post("/delete-review", (req, res) => {
    if (checkAuthentication(req.sessionID) == false) {
        res.redirect("/access-denied");
        return;
    }
    for (let i = 0; i < allRestaurants.length; i++) {
        if (allRestaurants[i].id == req.body.id) {
            db.prepare("DELETE FROM restaurants WHERE id = ?").run(req.body.id)
        }
    }

    updateAllRestaurants();
    res.redirect("delete-reviews")
})

app.post("/update-review", (req, res) => {
    if (checkAuthentication(req.sessionID) == false) {
        res.redirect("/access-denied");
        return;
    }

    for (let i = 0; i < allRestaurants.length; i++) {
        if (allRestaurants[i].id == req.body.id) {
            if (req.body.name !== allRestaurants[i].name) db.prepare("UPDATE restaurants SET name = ? WHERE id = ?").run(req.body.name, req.body.id);
            db.prepare("UPDATE restaurants SET score = ?, review = ?, city = ?, address = ?, imageLink = ? WHERE id = ?")
                .run(req.body.score, req.body.review, req.body.city, req.body.address, req.body.imageLink, req.body.id);
        }
    }

    updateAllRestaurants();
    res.redirect("edit-reviews");
})

app.post("/add-review", (req, res) => {
    if (checkAuthentication(req.sessionID) == false) {
        res.redirect("/access-denied");
        return; 
    }
    db.prepare("INSERT INTO restaurants (name, score, review, imageLink, city, address) VALUES (?, ?, ?, ?, ?, ?)").run(req.body.name, req.body.score, req.body.review, req.body.imageLink, req.body.city, req.body.address);

    updateAllRestaurants();
    res.redirect("add-reviews");
});

app.listen(port, () => {
    console.log("listening on port " + port)
    removeOldSessions();
    setInterval(removeOldSessions, threeHoursInMilliseconds);
    updateAllRestaurants();
});

