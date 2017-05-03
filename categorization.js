var mysql = require('mysql');
var hasher = require('./hasher');

var pool  = mysql.createPool({
  host: process.env.HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.USER || 'expenses-manager',
  password: process.env.PASSWORD || 'Expmngapp9/9',
  database: process.env.DATABASE || 'expenses_manager_db'
});

exports.categorizeTransactions = (transactions, callback) => {
  let categoriesOfTransactions = [];
  let cnt = {cnt: transactions.length};
  pool.getConnection((err, connection) => {
    for (var i = 0; i < transactions.length; i++) {
      categoriesOfTransactions.push('');
      categorizeTransaction(transactions[i], i, cnt, categoriesOfTransactions, connection, (categories) => {
        connection.release();
        callback(categories);
      });
    }
  });
}

function categorizeTransaction(transaction, position, cnt, categoriesOfTransactions, connection, callback) {
  let infoToHash = transaction.accountParty.iban + transaction.accountParty.bic + transaction.accountParty.info;
  let accountID = hasher.hashAccountInfo(infoToHash);

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
      } else {
        categoriesOfTransactions[position] = 'OTHERS_EXPENSE';
      }
    } else {
      categoriesOfTransactions[position] = rows[0].category_name;
    }
    if (--cnt.cnt === 0) {
      callback(categoriesOfTransactions);
    }
  });

}

exports.addCategorization = (categorizedTransaction) => {
  let infoToHash = categorizedTransaction.accountParty.iban + categorizedTransaction.accountParty.bic + categorizedTransaction.accountParty.info;
  let accountID = hasher.hashAccountInfo(infoToHash);

  pool.getConnection((err, connection) => {
    getAccountPartyCategories(accountID, connection, (accountPartyCategories) => {
      if (accountPartyCategories.length === 0) {
        insertAccountParty(accountID, connection, () => {
          insertCategoryIfNecessary(categorizedTransaction.category, categorizedTransaction.amount, connection, () => {
            insertAccountPartyCategory(accountID, categorizedTransaction.category, connection, connection.release);
          });
        });
      } else {
        if (accountPartyCategories.find((accountPartyCategory) => accountPartyCategory.category_name === categorizedTransaction.category)) {
          increaseCategoryWeight(accountID, categorizedTransaction.category, connection, connection.release);
        } else {
          insertAccountPartyCategory(accountID, categorizedTransaction.category, connection, connection.release);
        }
      }
    });
  });
}

function getAccountPartyCategories(accountID, connection, callback) {
  let getAccountPartyCategoriesSQL =
  'SELECT * ' +
  'FROM account_party_category ' +
  'WHERE account_id = ?'

  connection.query(getAccountPartyCategoriesSQL, [accountID], function (err, rows, fields) {
    if (err) throw err;
    callback(rows);
  });
}

function getCategory(categoryName, connection, callback) {
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

function insertCategoryIfNecessary(categoryName, amount, connection, callback) {
  getCategory(categoryName, connection, (category) => {
    if (category === null) {
      let categoryType = 'EXPENSE';
      if (amount > 0) {
        categoryType = 'INCOME'
      }
      insertCategory(categoryName, categoryType, connection, callback);
    } else if (callback) {
      callback();
    }

  });
}

function insertCategory(categoryName, categoryType, connection, callback) {
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

function insertAccountParty(accountID, connection, callback) {
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

function insertAccountPartyCategory(accountID, categoryName, connection, callback) {
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

function increaseCategoryWeight(accountID, categoryName, connection, callback) {
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
