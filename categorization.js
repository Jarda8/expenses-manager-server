var mysql = require('mysql');
var hasher = require('./hasher');
var config = require('./config');

var connection = mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database
});

connection.connect(err => {
  if (err) {
    console.error('error connecting to db: ' + err.stack);
    return;
  }
  console.log('connected to db as id ' + connection.threadId);
});

exports.categorizeTransactions = (transactions, callback) => {

  // let categoriesOfTransactions = transactions.map(categorizeTransaction);
  let categoriesOfTransactions = [];
  let cnt = {cnt: transactions.length};
  for (var i = 0; i < transactions.length; i++) {
    categoriesOfTransactions.push('');
    categorizeTransaction(transactions[i], i, cnt, categoriesOfTransactions, callback);
  }


  // connection.end();
  // return categoriesOfTransactions;
}

function categorizeTransaction(transaction, position, cnt, categoriesOfTransactions, callback) {
  let infoToHash = transaction.accountParty.iban + transaction.accountParty.bic + transaction.accountParty.info;
  console.log('infoToHash: ' + infoToHash);
  let accountID = hasher.hashAccountInfo(infoToHash);
  // console.log('accountID v categorizeTransaction: ' + accountID.toString("hex"));

  let sql =
  'SELECT category_name ' +
  'FROM account_party_category ' +
  'WHERE account_id = ? AND weight = (SELECT MAX(weight) ' +
                               'FROM account_party_category ' +
                               'WHERE account_id = ?)';

  connection.query(sql, [accountID, accountID], function (err, rows, fields) {
    if (err) throw err;
    if (rows.length === 0) {
      if (transaction.amount > 0) {
        categoriesOfTransactions[position] = 'OTHERS_INCOME';
        // callback('OTHERS_INCOME');
      } else {
        categoriesOfTransactions[position] = 'OTHERS_EXPENSE';
        // callback('OTHERS_EXPENSE');
      }
    } else {
      categoriesOfTransactions[position] = rows[0].category_name;
      // callback(rows[0].category_name);
    }
    if (--cnt.cnt === 0) {
      callback(categoriesOfTransactions);
    }
  });

}

exports.addCategorization = (categorizedTransaction) => {
  let infoToHash = categorizedTransaction.accountParty.iban + categorizedTransaction.accountParty.bic + categorizedTransaction.accountParty.info;
  let accountID = hasher.hashAccountInfo(infoToHash);
  console.log(accountID.toString());

  getAccountPartyCategories(accountID, (accountPartyCategories) => {
    if (accountPartyCategories.length === 0) {
      insertAccountParty(accountID, () => {
        insertCategoryIfNecessary(categorizedTransaction.category, categorizedTransaction.amount, () => {
          insertAccountPartyCategory(accountID, categorizedTransaction.category);
        });
      });
    } else {
      if (accountPartyCategories.find((accountPartyCategory) => accountPartyCategory.category_name === categorizedTransaction.category)) {
        increaseCategoryWeight(accountID, categorizedTransaction.category);
      } else {
        insertAccountPartyCategory(accountID, categorizedTransaction.category);
      }
    }
  });

}

function getAccountPartyCategories(accountID, callback) {
  let getAccountPartyCategoriesSQL =
  'SELECT * ' +
  'FROM account_party_category ' +
  'WHERE account_id = ?'

  connection.query(getAccountPartyCategoriesSQL, [accountID], function (err, rows, fields) {
    if (err) throw err;
    callback(rows);
  });
}

function getCategory(categoryName, callback) {
  let getCategorySQL =
  'SELECT * ' +
  'FROM category ' +
  'WHERE category_name = ?'

  connection.query(getCategorySQL, [categoryName], function (err, rows, fields) {
    if (err) throw err;
    if (rows.length === 0) {
      callback(null);
    } else {
      callback(rows[0]);
    }
  });
}

function insertCategoryIfNecessary(categoryName, amount, callback) {
  getCategory(categoryName, (category) => {
    if (category === null) {
      let categoryType = 'EXPENSE';
      if (amount > 0) {
        categoryType = 'INCOME'
      }
      insertCategory(categoryName, categoryType, callback);
    }
    if (callback) {
      callback();
    }
  });
}

function insertCategory(categoryName, categoryType, callback) {
  let insertCategorySQL =
  'INSERT INTO category (category_name, category_type) ' +
  'VALUES (?, ?)';

  connection.query(insertCategorySQL, [categoryName, categoryType], function (err, rows, fields) {
    if (err) throw err;
    if (callback) {
      callback();
    }
  });
}

function insertAccountParty(accountID, callback) {
  let insertAccountPartySQL =
  'INSERT INTO account_party (account_id) ' +
  'VALUES (?)';

  connection.query(insertAccountPartySQL, [accountID], function (err, rows, fields) {
    if (err) throw err;
    if (callback) {
      callback();
    }
  });
}

function insertAccountPartyCategory(accountID, categoryName, callback) {
  let insertAccountPartyCategorySQL =
  'INSERT INTO account_party_category (account_id, category_name, weight) ' +
  'VALUES (?, ?, 1)';

  connection.query(insertAccountPartyCategorySQL, [accountID, categoryName], function (err, rows, fields) {
    if (err) throw err;
    if (callback) {
      callback();
    }
  });
}

function increaseCategoryWeight(accountID, categoryName, callback) {
  let increaseCategoryWeightSQL =
  'UPDATE account_party_category ' +
  'SET weight = weight + 1 ' +
  'WHERE account_id = ? AND category_name = ?';

  connection.query(increaseCategoryWeightSQL, [accountID, categoryName], function (err, rows, fields) {
    if (err) throw err;
    if (callback) {
      callback();
    }
  });
}
