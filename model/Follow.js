const followsCollection = require('../db').db().collection('follows')
const usersCollection = require('../db').db().collection('users')
const {ObjectID} = require('mongodb')
const User = require('./User')

let Follow = function(followerUsername, authorId) {
    this.followerUsername = followerUsername
    this.authorId = authorId
    this.errors = []
}

Follow.prototype.cleanUp = function() {
    if(typeof(this.followerUsername) != 'string') {this.followerUsername = ""}
}

Follow.prototype.validate = async function(action) {
    let followedAccount = await usersCollection.findOne({username: this.followerUsername})
    if(followedAccount) {
        this.followedId = followedAccount._id
    }else {
        this.errors.push("cannot follow a user that doesn't exist");
    }

    // let doesFollowAlreadyExist = await followsCollection.findOne({followedId: this.followerId, authorId: new ObjectID(this.authorId)})
    let doesFollowAlreadyExist = await followsCollection.findOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
    if(action == 'follow') {
        if(doesFollowAlreadyExist) {
            this.errors.push("You are already following the user")
        }
    }
    if(action == 'unfollow') {
        if(!doesFollowAlreadyExist) {
            this.errors.push("You are not following the user")
        }
    }
    if(this.followedId.equals(this.authorId)) {
        this.errors.push("you cannot follow yourself");
    }
}

Follow.prototype.create = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate('follow')

        if(!this.errors.length) {
            await followsCollection.insertOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve();
        }else {
            reject(this.errors)
        }
    })
}

Follow.isVisitorFollowing = async function(followedId, visitorId) {
    let followDoc = await followsCollection.findOne({followedId: followedId, authorId: new ObjectID(visitorId)})
    if(followDoc) {
        return true;
    }else {
        return false;
    }
}

Follow.prototype.delete = function() {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate('unfollow')

        if(!this.errors.length) {
            await followsCollection.deleteOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve();
        }else {
            reject(this.errors)
        }
    })
}

Follow.getFollowersById = function(id) {
    return new Promise(async (resolve, reject) => {
        try {
            let followers = await followsCollection.aggregate([
                {$match: {followedId: id}},
                {$lookup: {from: "users", localField: "authorId", foreignField: "_id", as: "userDoc"}},
                {$project: {
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }}
            ]).toArray()
            followers = followers.map(follower => {
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}
            })

            resolve(followers)
        } catch {
            reject("errors in follow model");
        }
    })
}

Follow.getFollowingById = function(id){
    return new Promise(async (resolve, reject) =>{
        try{
            let followers = await followsCollection.aggregate([
                {$match: {authorId: id}},
                {$lookup: {from: "users", localField: "followedId", foreignField: "_id", as: "userDoc"}},
                {$project: {
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }}
            ]).toArray()
            followers = followers.map(function(follower) {
                //create a user
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}
            })
            resolve(followers) 
        }catch{
            reject()
        }
    })
}


Follow.countFollowersById = function(id){
    return new Promise(async (resolve, reject) => {
        let followerCount = await followsCollection.countDocuments({followedId: id})
        resolve(followerCount)
    })
}

Follow.countFollowingById = function(id){
    return new Promise(async (resolve, reject) => {
        let count = await followsCollection.countDocuments({authorId: id})
        resolve(count)
    })
}

module.exports = Follow