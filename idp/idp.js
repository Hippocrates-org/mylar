const IS_IDP = true;

    
if (Meteor.isClient) {
    Deps.autorun(function () {
        Meteor.subscribe("userdata");
    });
/*

    //EVENTS HANDLERS BUTTON
    Template.hello.events({
	'click #loginBtn': function(evt) {
	    CreateUser();
	},
	'click #logoutBtn': function(evt) {
	    //UPDATE USER COLLECTION ONLINE FALSE
	    Meteor.call('UpdateOnlineFalse');
	    Meteor.logout();
	},
	'keypress #formCreateUser': function(evt) {
	    if (evt.keyCode == 13){
		CreateUser();
		return false;
	    }
	}
    });

    
*/


//FUNCTIONS
function CreateUser(){
  var user = $("#username").val().trim();
  var password = $("#password").val().trim();
  if(user.length !== 0 && password.length !=0){
    Accounts.createUser({username:user, password:password},
			function(error){
			    if (error) {
				$("#errorUsernameMsg").text(error);
			    }
			});
  }else{
      $("#errorUsernameMsg").text('Username Must Contain At least 5 Characters');
      //alert('Must Contain At least 5 Characters');
  }
}


function LoginUser(){
  var username = $("#usernameLogin").val().trim();
  var password = $("#passwordLogin").val().trim();
  Meteor.loginWithPassword({username: username}, password,
  function (error){
    if(error){
      $("#loginErroMsg").text('Warning: Incorrect Login');
    } else {
      $('#usernameLogin').val('');
      $('#passwordLogin').val(''); 
      $("#loginErroMsg").text('');
    }
  });
}

    
    
    //EVENTS HANDLERS BUTTON
Template.createArea.events({
    'click #createUserBtn': function(evt) {
	CreateUser();
    },
    'keypress #formCreateUser': function(evt) {
	if (evt.keyCode == 13){
	    CreateUser();
	    return false;
	}
    }
});

    
Template.loginArea.events({
  'click #loginBtn': function(evt) {
    LoginUser();
  },
  'keypress #formLoginUser': function(evt) {
    if (evt.keyCode == 13){
      LoginUser();
      return false;
    }
  }
});


Template.home.events({
    'click #logoutBtn': function(evt) {
	Meteor.logout();
    },
});
   	    
    Template.hello.user_email = function () {
        var user = Meteor.users.findOne();
        if (user) {
	    // TODO: more inconsistency in idp: why would we need this for??
	    if (!_.has(user, 'keys')) {
		var user_princ = new Principal("user", user.emails[0].address);
                Meteor.users.update(user._id, {$set: {
                    keys: serialize_keys(user_princ.keys),
                    username:user.emails[0].address
                }});
            } 
            return user.emails[0].address;
        }
    };

}
 

// calls cb with an application specific key
get_app_key = function(arg, origin, cb) {
    Meteor.call('getappkey', origin, function(err, res) {
	if (err) {
	    throw new Error("cannot get app key from server");
	}
	cb && cb(res);
    });
}

// calls cb with a certificate
certify_pk = function(pk, origin, cb) {
    Meteor.call("certifypk", pk, origin, function(err, cert) {
	if (err) {
	    throw new Error("cannot get cert from server");
	}
	cb && cb(cert);
    });
}
    
sign_text = function(user, origin, pk) {
    return user + "+++" + origin + "+++" + pk; //TODO: fix this so no formatting attacks possible 
}

if (Meteor.isServer) {


    var priv = '{"sym_key":[-2078830561,1682189118,1575134806,156233709,-391209604,1727757807,-1046869112,873814060],"sign":"0000006275556c333caa9d7cd3a26fd26eb48403773bd36ceb1be0","decrypt":"0000004f0d7ae3323dea172ee8c53f3b83845ee81be1f183e4fc51","encrypt":"021cbeb072a8a136a35efd7d59eac32d4415929bc1ca9d5a0e1e640789079a91dcc534c65119ed3fbddb12c918c5a582","verify":"b7bf9d94519d221ec2dd5cb033da55149852858c776d66bf8568a85a45b099c009c926575494bddf3fe2783c15de337b"}';

    var idpkeys = deserialize_keys(priv);
    
  Meteor.startup(function () {
      Meteor.publish("userdata", function () {
          return Meteor.users.find({_id: this.userId});
      });
  });

  Meteor.users.allow({
      update: function (userId, doc) {
         return true; //TODO: allow script, but make safe later...
         //return userId === doc._id;
      }
  });

  Meteor.methods({
      // look up a user's public key
      //args: username
      //returns: public keys corresponding to username, undefined if user doesn't exist
      get_public: function (name) {
	  console.log("idp get_public");
          var users = Meteor.users.find({
              'username': name
          }).fetch();
	  var sz = _.size(users);
	  if (sz != 1) {
	      console.log("found " + sz + " user called " + name);
	      return undefined;
	  }
	  var user = users[0];
          if(!user || !user.keys){
            return undefined;
          }
          console.log("idp: get_public for " + name);
          return serialize_public(deserialize_keys(user.keys));

      },

      
      // calls cb with an application specific key
      getappkey : function(origin) {
	  console.log("get app key, origin " + origin);
	  return "temppasswd"; //TEMPORARY!
      },
      
      // calls cb with a certificate
      certifypk : function(pk, origin) {
	  var c = sign_text("temp", pk, origin); // USER Meteor.user()
	  var cert = "";
	  try { 
	    cert = base_crypto.sign(sign_text, idpkeys.sign);
	  } catch (err) {
	      console.log("err is " + err);
	  }
	  return cert;
      },
      

      // look up a user's keys (private and public)
      // args: username, password
      // returns user's keys, undefined if user is not found
      get_keys: function (name, pwd) {
          // TODO: check password
	  console.log("get_keys name " + name);
          var user = Meteor.users.findOne({
              'username': name
          });
	  if (!user) {
	      throw new Error("user " + user + " does not exist at idp");
	  }
          return user.keys;
      },
      
      // update keys for user, creates new user if user doesn't exsist
      // args: username, password, new keys
      // returns: new keys
      create_keys:  function (name, pwd, nkeys) {
	  console.log("create user " + name + " " + nkeys);
          var user = Meteor.users.findOne({'username': name});
	  console.log("idp gets keys " + nkeys);	  
          if (user) {//TODO: must check password!
	      if (!nkeys) {
		  throw new Error("nkeys is null");
	      }
              if (!_.has(user, 'keys')) {
		  console.log("NEW KEYS for " + name + " keys " + nkeys);
                  Meteor.users.update(user._id, {$set: {
                      keys: nkeys
                  }});
              }
              return user.keys;
          } else {

              Meteor.users.insert({username: name , keys: nkeys});
	      console.log('keys inserted for ' + name);
	      
              return nkeys;
          }
      }

  });
}
