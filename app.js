const express = require("express");
const bcrypt = require("bcryptjs");
const expressHandlebars = require("express-handlebars");
const app = express();

const session = require("express-session");
const csrf = require('csurf')
const csrfProtection = csrf();
const sqliteStore = require("better-sqlite3-session-store")(session);

const db = require("better-sqlite3")('storage/database.db', {
    fileMustExist: true
});

// MODEL ATTRIBUTES ORDER - 
// Name, Score, Review, Location, ImageLink

let allRestaurants;
let allAdmins;
const port = 3000;
const threeHoursInMilliseconds = 3 * 60 * 60 * 1000;
const loginAttemptsLimit = 5;

function updateAllRestaurants() {
    allRestaurants = db.prepare("SELECT * FROM restaurants").all();
}

// MAKE FIND RESTAURANT FUNCTION

function findUser(id) {
    for (let i = 0; i < allAdmins.length; i++) {
        if (allAdmins[i].id == id) {
            return allAdmins[i];
        } 
    }

    throw Error;
}

function updateAllAdmins() {
    allAdmins = db.prepare("SELECT * FROM admins").all();
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

    if (!allSessions) return;

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
app.use(csrfProtection);

app.set('view engine', 'hbs')

app.engine('hbs', expressHandlebars({
    extname: ".hbs",
    defaultLayout: "primary-layout.hbs"
}))

app.use(express.static("public"))

app.get("/", (req, res) => {
    res.redirect("/all-reviews?page=1")
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
    updateAllRestaurants();
    const restaurantsPerPage = 2;

    const page = parseInt(req.query.page);
    let nextPage = page + 1;
    let previousPage = page - 1;
    let lastPage = allRestaurants.length / restaurantsPerPage;

    const endIndex = (page * restaurantsPerPage);
    let startIndex = endIndex - restaurantsPerPage;
    
    let restaurantsInPage = allRestaurants.slice(startIndex, endIndex);

    // Basically rounds up, i.e 13/4 = 3.25 => 4
    if (lastPage % 1 != 0) {
        lastPage = Math.round(lastPage - 0.5) + 1 
    }
    
    if (previousPage < 1) previousPage = false;
    if (nextPage > lastPage) nextPage = false;
    
    res.render("all-reviews.hbs", {
        restaurantsInPage,
        page,
        nextPage,
        previousPage,
        lastPage,
    })
})

app.get("/add-reviews", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    res.render("add-reviews.hbs",{csrfToken: req.csrfToken()})
})

app.get("/update-reviews", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    updateAllRestaurants();
    res.render("update-reviews.hbs", {
        allRestaurants,
        csrfToken: req.csrfToken()
    })
})

app.get("/delete-reviews", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    };

    updateAllRestaurants();
    res.render("delete-reviews.hbs", {
        allRestaurants,
        csrfToken: req.csrfToken()
    });
})

app.get("/access-denied", (req, res) => {
    res.render("access-denied.hbs");
})

app.get("/login", (req, res) => {
    res.render("login.hbs", {csrfToken: req.csrfToken()});
})

app.get("/register-admin", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    res.render("register-admin.hbs", {csrfToken: req.csrfToken()})
})

app.get("/update-admins", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }
    res.render("update-admins.hbs", {allAdmins, csrfToken: req.csrfToken()});
})

app.get("/delete-admins", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    res.render("delete-admins.hbs", {allAdmins, csrfToken: req.csrfToken()});
})

app.post("/delete-admins", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    if (findUser(req.body.id))
        db.prepare("DELETE FROM admins WHERE id = ?").run(req.body.id)

    updateAllAdmins();
    
    res.render("delete-admins.hbs", {allAdmins, csrfToken: req.csrfToken()});
})

app.post("/update-admins", (req, res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    let targetUser = findUser(req.body.id);

    if (targetUser.password !== req.body.password) {
        targetUser.password = req.body.password;
    }

    db.prepare("UPDATE admins SET email = ?, password = ?, loginAttempts = ? WHERE id = ?").run(req.body.email, targetUser.password, req.body.loginAttempts, req.body.id);
    updateAllAdmins();

    res.render("update-admins.hbs", {allAdmins, csrfToken: req.csrfToken()});
})

app.post("/register-admin", async (req,res) => {
    if (checkAuthentication(req.sessionID) === false) {
        res.redirect("/access-denied");
        return;
    }

    let salt = await bcrypt.genSalt(10);
    let hash = await bcrypt.hash(req.body.password, salt);

    db.prepare("INSERT INTO admins (email, password, loginAttempts, isOwner) VALUES (?, ?, ?, ?)").run(req.body.email, hash, 0, 0);
    updateAllAdmins();
    res.render("register-admin.hbs", {csrfToken: req.csrfToken()})
})



// Add counter to user to lock account, so you can't have infinite login attempts to account.
app.post("/login", async (req, res) => {
    const user = db.prepare("SELECT * FROM admins WHERE email = ?").get(req.body.email);
    if (user) {
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (isMatch && parseInt(user.loginAttempts) < loginAttemptsLimit) {
            req.session.isAuth = true;
            db.prepare("UPDATE admins SET loginAttempts = 0").run();
            res.redirect("./")
        } else {
            db.prepare("UPDATE admins set loginAttempts = ?").run(user.loginAttempts + 1)
            res.render("login.hbs", {csrfToken: req.csrfToken(), errorMessage: "Incorrect password..."})
        }
    } else {
        res.render("login.hbs", {csrfToken: req.csrfToken(), errorMessage: "Email does not exist..."})
    }
})

app.post("/delete-reviews", (req, res) => {
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

app.post("/update-reviews", (req, res) => {
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
    res.redirect("update-reviews");
})

app.post("/add-reviews", (req, res) => {
    if (checkAuthentication(req.sessionID) == false) {
        res.redirect("/access-denied");
        return; 
    }
    db.prepare("INSERT INTO restaurants (name, score, review, imageLink, city, address) VALUES (?, ?, ?, ?, ?, ?)").run(req.body.name, req.body.score, req.body.review, req.body.imageLink, req.body.city, req.body.address);

    updateAllRestaurants();
    res.redirect("add-reviews");
});



app.use((req, res) => {
    res.render("error-404")
})

app.listen(port, () => {
    console.log("listening on port " + port)
    removeOldSessions();
    setInterval(removeOldSessions, threeHoursInMilliseconds);
    updateAllRestaurants();
    updateAllAdmins();
});

