// ============================================
// Google Apps Script для админки магазина
// Поддержка: добавление, редактирование, удаление
// ИСПРАВЛЕНО: сравнение ID через String (число в ячейке vs строка из JSON);
// UPDATE: обновление по размеру без дублирования, количество плюсуется.
// ============================================

// ============================================
// Система логирования
// ============================================

function getOrCreateLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Логи");
  
  if (!sheet) {
    sheet = ss.insertSheet("Логи");
    sheet.getRange(1, 1, 1, 5).setValues([["Дата", "Время", "Действие", "Детали", "Статус"]]);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 80);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 400);
    sheet.setColumnWidth(5, 100);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#f0f0f0");
  }
  
  return sheet;
}

function addLog(action, details, status) {
  try {
    var sheet = getOrCreateLogSheet();
    var now = new Date();
    var date = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd.MM.yyyy");
    var time = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss");
    
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 5).setValues([[date, time, action, details, status]]);
    
    // Подсветка статуса
    var statusCell = sheet.getRange(2, 5);
    if (status === "Успех") {
      statusCell.setBackground("#d4edda").setFontColor("#155724");
    } else if (status === "Ошибка") {
      statusCell.setBackground("#f8d7da").setFontColor("#721c24");
    }
  } catch(e) {
    // Логирование не должно ломать основную логику
    Logger.log("Ошибка логирования: " + e.toString());
  }
}

function getLogs(limit) {
  try {
    var sheet = getOrCreateLogSheet();
    var data = sheet.getDataRange().getValues();
    var logs = [];
    
    var maxRows = limit ? Math.min(limit + 1, data.length) : data.length;
    
    for (var i = 1; i < maxRows; i++) {
      logs.push({
        date: data[i][0],
        time: data[i][1],
        action: data[i][2],
        details: data[i][3],
        status: data[i][4]
      });
    }
    
    return createResponse({ result: "success", logs: logs, total: data.length - 1 });
  } catch(error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

function clearLogs() {
  try {
    var sheet = getOrCreateLogSheet();
    var lastRow = sheet.getLastRow();
    
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    
    return createResponse({ result: "success", message: "Журнал очищен" });
  } catch(error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

function doPost(e) {
  var lock = LockService.getPublicLock();
  lock.waitLock(30000);
  
  try {
    if (!e.postData || !e.postData.contents) {
      return createResponse({ result: "error", error: "No postData" });
    }
    
    var raw = e.postData.contents;
    var data;
    // Поддержка form-urlencoded (data=...) для обхода CORS preflight при запросах с другого домена
    if (typeof raw === 'string' && raw.indexOf('data=') === 0) {
      try {
        var encoded = raw.substring(5).replace(/\+/g, ' ');
        data = JSON.parse(decodeURIComponent(encoded));
      } catch (parseErr) {
        return createResponse({ result: "error", error: "Invalid form data: " + parseErr.toString() });
      }
    } else {
      data = JSON.parse(raw);
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Merch");
    
    if (!sheet) {
      return createResponse({ result: "error", error: "Лист 'Merch' не найден" });
    }
    
    if (data.operation === 'toggleDisabled' && data.productId) {
      var toggleName = getProductNameById(sheet, data.productId);
      var toggleData = sheet.getDataRange().getValues();
      var idStr = String(data.productId).trim();
      var toggledRows = 0;
      var newDisabled = data.disabled === true;
      for (var ti = 1; ti < toggleData.length; ti++) {
        if (String(toggleData[ti][0]).trim() === idStr) {
          sheet.getRange(ti + 1, 14).setValue(newDisabled);
          toggledRows++;
        }
      }
      addLog(newDisabled ? "Отключение товара" : "Включение товара", "ID: " + data.productId + ", Название: " + toggleName + ", Строк: " + toggledRows, "Успех");
      return createResponse({ result: "success", message: (newDisabled ? "Отключено" : "Включено") + " строк: " + toggledRows });
    }

    if (data.operation === 'delete' && data.productId) {
      var productName = getProductNameById(sheet, data.productId);
      var deletedCount = deleteRowsByProductId(sheet, data.productId);
      addLog("Удаление товара", "ID: " + data.productId + ", Название: " + productName + ", Удалено строк: " + deletedCount, "Успех");
      return createResponse({ 
        result: "success", 
        message: "Удалено строк: " + deletedCount 
      });
    }
    
    if (data.operation === 'update' && data.productId && data.products && Array.isArray(data.products)) {
      var productInfo = data.products[0] || {};
      var result = handleUpdate(sheet, data.productId, data.products);
      addLog("Обновление товара", "ID: " + data.productId + ", Название: " + (productInfo.name || 'N/A') + ", Обновлено: " + result.updated + ", Добавлено: " + result.added, "Успех");
      return createResponse({ 
        result: "success", 
        message: "Обновлено: " + result.updated + " строк, добавлено: " + result.added
      });
    }
    
    if (data.operation === 'add' && data.products && Array.isArray(data.products)) {
      var addedRows = 0;
      var productInfo = data.products[0] || {};
      // Оптимизация: собираем все строки и добавляем одним batch
      var rowsToAdd = [];
      for (var i = 0; i < data.products.length; i++) {
        rowsToAdd.push(createRow(data.products[i]));
      }
      if (rowsToAdd.length > 0) {
        var lastRow = sheet.getLastRow();
        if (lastRow < 1) lastRow = 1;
        sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 14).setValues(rowsToAdd);
        addedRows = rowsToAdd.length;
      }
      var sizes = data.products.map(function(p) { return p.size; }).join(', ');
      addLog("Добавление товара", "ID: " + (productInfo.id || 'N/A') + ", Название: " + (productInfo.name || 'N/A') + ", Категория: " + (productInfo.category || 'N/A') + ", Капсула: " + (productInfo.capsule || 'N/A') + ", Размеры: " + sizes, "Успех");
      return createResponse({ 
        result: "success", 
        message: "Добавлено строк: " + addedRows 
      });
    }
    
    if (data.id) {
      var row = createRow(data);
      sheet.appendRow(row);
      addLog("Добавление товара", "ID: " + data.id + ", Название: " + (data.name || 'N/A'), "Успех");
      return createResponse({ result: "success", message: "Товар добавлен" });
    }

    // Операции с заказами
    if (data.operation === 'createOrder') {
      return createOrder(data);
    }

    if (data.operation === 'updateOrderStatus' && data.orderId && data.status) {
      return updateOrderStatus(data.orderId, data.status);
    }

    if (data.operation === 'deleteOrder' && data.orderId) {
      return deleteOrder(data.orderId);
    }
    
    // Операции с категориями
    if (data.operation === 'addCategory' && data.categoryName) {
      return addCategory(data.categoryName);
    }
    
    if (data.operation === 'deleteCategory' && data.categoryName) {
      return deleteCategory(data.categoryName);
    }
    
    // Операции с размерами
    if (data.operation === 'addSize' && data.sizeName) {
      return addSize(data.sizeName);
    }
    
    if (data.operation === 'deleteSize' && data.sizeName) {
      return deleteSize(data.sizeName);
    }
    
    // Операции с капсулами
    if (data.operation === 'addCapsule' && data.capsuleName) {
      return addCapsule(data.capsuleName, data.color, data.prefix, data.outline);
    }
    
    if (data.operation === 'updateCapsule' && data.capsuleName) {
      return updateCapsule(data.capsuleName, data.color, data.prefix, data.outline);
    }
    
    if (data.operation === 'deleteCapsule' && data.capsuleName) {
      return deleteCapsule(data.capsuleName);
    }
    
    // Массовый импорт
    if (data.operation === 'bulkImport' && data.rows && Array.isArray(data.rows)) {
      return handleBulkImport(sheet, data.rows);
    }
    
    // Очистка логов
    if (data.operation === 'clearLogs') {
      return clearLogs();
    }
    
    addLog("Неизвестная операция", JSON.stringify(data).substring(0, 200), "Ошибка");
    return createResponse({ result: "error", error: "Неверный формат данных" });
    
  } catch(error) {
    addLog("Критическая ошибка", error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createRow(product) {
  var category = String(product.category || "").trim();
  var capsule = String(product.capsule || "").trim();
  var preorder = product.preorder === true || product.preorder === 'true';
  var disabled = product.disabled === true || product.disabled === 'true' || product.disabled === 1;
  return [
    String(product.id || ""),
    category,
    String(product.name || "").trim(),
    String(product.size || "").trim(),
    Number(product.quantity) || 0,
    Number(product.price) || 0,
    String(product.image1 || "").trim(),
    String(product.image2 || "").trim(),
    String(product.image3 || "").trim(),
    String(product.image4 || "").trim(),
    capsule,
    String(product.description || "").trim(),
    preorder,
    disabled
  ];
}

// ============================================
// Операции с заказами
// ============================================

// Лист заказов должен называться именно "Заказы". Столбцы: OrderId, CreatedAt, CustomerName, CustomerPhone, Status, ItemsJson, Total.
function getOrCreateOrdersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Заказы");
  
  if (!sheet) {
    sheet = ss.insertSheet("Заказы");
    sheet.getRange(1, 1, 1, 7).setValues([[
      "OrderId",
      "CreatedAt",
      "CustomerName",
      "CustomerPhone",
      "Status",
      "ItemsJson",
      "Total"
    ]]);
  }
  
  return sheet;
}

function createOrder(data) {
  try {
    if (!data.customerName || !data.customerPhone) {
      return createResponse({ result: "error", error: "Необходимо указать имя и телефон" });
    }
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return createResponse({ result: "error", error: "Список товаров заказа пуст" });
    }
    
    var sheet = getOrCreateOrdersSheet();
    var now = new Date();
    var createdAt = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm:ss");
    var phoneStr = String(data.customerPhone || "").replace(/\D/g, "");
    var last4 = phoneStr.length >= 4 ? phoneStr.slice(-4) : ("0000" + phoneStr).slice(-4);
    var orderId = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMddHHmmss") + "-" + last4;
    var status = "Новый";
    
    var items = data.items.map(function(item) {
      return {
        productId: String(item.productId || "").trim(),
        productName: String(item.productName || "").trim(),
        size: String(item.size || "").trim(),
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0
      };
    });
    
    var total = 0;
    for (var i = 0; i < items.length; i++) {
      total += items[i].price * items[i].quantity;
    }
    
    var itemsJson = JSON.stringify(items);
    
    // Телефон с апострофом, чтобы + не воспринимался как формула
    var phoneForSheet = "'" + String(data.customerPhone).trim();
    sheet.appendRow([
      orderId,
      createdAt,
      String(data.customerName).trim(),
      phoneForSheet,
      status,
      itemsJson,
      total
    ]);
    
    addLog("Создание заказа", "OrderId: " + orderId + ", Покупатель: " + data.customerName + ", Телефон: " + data.customerPhone + ", Позиции: " + items.length, "Успех");
    
    return createResponse({
      result: "success",
      orderId: orderId,
      status: status,
      total: total
    });
  } catch (error) {
    addLog("Создание заказа", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function getOrders() {
  try {
    var sheet = getOrCreateOrdersSheet();
    var data = sheet.getDataRange().getValues();
    var orders = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var items = [];
      var rawPhone = row[3];
      var customerPhoneStr = "";
      if (typeof rawPhone === "string" && rawPhone.indexOf("ERROR") === -1) {
        customerPhoneStr = rawPhone;
      } else if (typeof rawPhone === "number") {
        customerPhoneStr = String(rawPhone);
      }
      if (row[5]) {
        try {
          var parsed = typeof row[5] === "string" ? row[5] : String(row[5]);
          if (parsed.indexOf("ERROR") === -1) {
            items = JSON.parse(parsed);
            if (!Array.isArray(items)) items = [];
          }
        } catch (e) {
          items = [];
        }
      }
      orders.push({
        orderId: row[0] != null ? String(row[0]) : "",
        createdAt: row[1] != null ? String(row[1]) : "",
        customerName: row[2] != null ? String(row[2]) : "",
        customerPhone: customerPhoneStr,
        status: row[4] != null ? String(row[4]) : "",
        items: items,
        total: row[6] != null ? Number(row[6]) : 0
      });
    }
    
    return createResponse({ result: "success", orders: orders });
  } catch (error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    if (!orderId || !newStatus) {
      return createResponse({ result: "error", error: "Не указан orderId или статус" });
    }
    
    var sheet = getOrCreateOrdersSheet();
    var data = sheet.getDataRange().getValues();
    var idStr = String(orderId).trim();
    var rowIndex = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === idStr) {
        rowIndex = i + 1; // 1-based
        break;
      }
    }
    
    if (rowIndex === -1) {
      return createResponse({ result: "error", error: "Заказ не найден" });
    }
    
    var currentStatus = String(sheet.getRange(rowIndex, 5).getValue() || "").trim();
    
    // Возврат остатков при отмене заказа (если заказ был Выполнен)
    if (newStatus === "Отмена" && currentStatus === "Выполнен") {
      var itemsJsonReturn = sheet.getRange(rowIndex, 6).getValue();
      if (itemsJsonReturn) {
        try {
          var itemsReturn = typeof itemsJsonReturn === "string" ? itemsJsonReturn : String(itemsJsonReturn);
          var itemsArr = JSON.parse(itemsReturn);
          if (Array.isArray(itemsArr)) {
            for (var k = 0; k < itemsArr.length; k++) {
              increaseMerchItem(itemsArr[k], idStr);
            }
          }
        } catch (e) {
          addLog("Возврат остатков по отмене заказа", "OrderId: " + idStr + ", ошибка парсинга ItemsJson: " + e.toString(), "Ошибка");
        }
      }
    }
    
    // Списание остатков при выполнении заказа
    if (newStatus === "Выполнен") {
      var itemsJson = sheet.getRange(rowIndex, 6).getValue();
      if (itemsJson) {
        try {
          var items = typeof itemsJson === "string" ? itemsJson : String(itemsJson);
          var itemsParsed = JSON.parse(items);
          if (Array.isArray(itemsParsed)) {
            for (var j = 0; j < itemsParsed.length; j++) {
              decreaseMerchItem(itemsParsed[j], idStr);
            }
          }
        } catch (e) {
          addLog("Списание остатков по заказу", "OrderId: " + idStr + ", ошибка парсинга ItemsJson: " + e.toString(), "Ошибка");
        }
      }
    }
    
    sheet.getRange(rowIndex, 5).setValue(newStatus);
    addLog("Изменение статуса заказа", "OrderId: " + idStr + ", Новый статус: " + newStatus, "Успех");
    
    return createResponse({ result: "success", orderId: idStr, status: newStatus });
  } catch (error) {
    addLog("Изменение статуса заказа", "OrderId: " + orderId + ", Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function deleteOrder(orderId) {
  try {
    if (!orderId) {
      return createResponse({ result: "error", error: "Не указан orderId" });
    }
    var sheet = getOrCreateOrdersSheet();
    var data = sheet.getDataRange().getValues();
    var idStr = String(orderId).trim();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === idStr) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) {
      return createResponse({ result: "error", error: "Заказ не найден" });
    }
    sheet.deleteRow(rowIndex);
    addLog("Удаление заказа", "OrderId: " + idStr, "Успех");
    return createResponse({ result: "success", orderId: idStr });
  } catch (error) {
    addLog("Удаление заказа", "OrderId: " + orderId + ", Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function decreaseMerchItem(item, orderId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var merchSheet = ss.getSheetByName("Merch");
    if (!merchSheet) {
      addLog("Списание остатков", "OrderId: " + orderId + ", Лист 'Merch' не найден", "Ошибка");
      return;
    }
    
    var data = merchSheet.getDataRange().getValues();
    var idStr = String(item.productId || "").trim();
    var sizeStr = String(item.size || "").trim();
    var qty = Number(item.quantity) || 0;
    
    if (!idStr || qty <= 0) {
      return;
    }
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowId = String(row[0] || "").trim();
      var rowSize = String(row[3] || "").trim();
      
      if (rowId === idStr && rowSize === sizeStr) {
        var current = Number(row[4]) || 0;
        var newQty = current - qty;
        if (newQty < 0) newQty = 0;
        merchSheet.getRange(i + 1, 5).setValue(newQty);
        addLog(
          "Списание остатков",
          "OrderId: " + orderId + ", ProductId: " + idStr + ", Size: " + sizeStr + ", Было: " + current + ", Списано: " + qty + ", Стало: " + newQty,
          "Успех"
        );
        break;
      }
    }
  } catch (error) {
    addLog("Списание остатков", "OrderId: " + orderId + ", Ошибка: " + error.toString(), "Ошибка");
  }
}

function increaseMerchItem(item, orderId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var merchSheet = ss.getSheetByName("Merch");
    if (!merchSheet) {
      addLog("Возврат остатков", "OrderId: " + orderId + ", Лист 'Merch' не найден", "Ошибка");
      return;
    }
    var data = merchSheet.getDataRange().getValues();
    var idStr = String(item.productId || "").trim();
    var sizeStr = String(item.size || "").trim();
    var qty = Number(item.quantity) || 0;
    if (!idStr || qty <= 0) return;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowId = String(row[0] || "").trim();
      var rowSize = String(row[3] || "").trim();
      if (rowId === idStr && rowSize === sizeStr) {
        var current = Number(row[4]) || 0;
        merchSheet.getRange(i + 1, 5).setValue(current + qty);
        addLog("Возврат остатков", "OrderId: " + orderId + ", ProductId: " + idStr + ", Size: " + sizeStr + ", Было: " + current + ", Возвращено: " + qty, "Успех");
        break;
      }
    }
  } catch (error) {
    addLog("Возврат остатков", "OrderId: " + orderId + ", Ошибка: " + error.toString(), "Ошибка");
  }
}

function getProductNameById(sheet, productId) {
  var data = sheet.getDataRange().getValues();
  var idStr = String(productId).trim();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === idStr) {
      return String(data[i][2] || 'Без названия');
    }
  }
  return 'Неизвестный товар';
}

function deleteRowsByProductId(sheet, productId) {
  var data = sheet.getDataRange().getValues();
  var deletedCount = 0;
  var idStr = String(productId).trim();
  
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === idStr) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  
  return deletedCount;
}

function handleUpdate(sheet, productId, products) {
  var data = sheet.getDataRange().getValues();
  var idStr = String(productId).trim();
  var existingBySize = {};
  var requestedSizes = {};
  
  for (var k = 0; k < products.length; k++) {
    requestedSizes[String(products[k].size || '').trim()] = true;
  }
  
  // Находим существующие строки
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() !== idStr) continue;
    var size = String(data[i][3] || '').trim();
    var qty = Number(data[i][4]) || 0;
    existingBySize[size] = { rowIndex: i + 1, quantity: qty };
  }
  
  // Удаляем строки с размерами, которых нет в запросе
  var toDelete = [];
  for (var sizeKey in existingBySize) {
    if (!requestedSizes[sizeKey]) {
      toDelete.push(existingBySize[sizeKey].rowIndex);
    }
  }
  toDelete.sort(function(a, b) { return b - a; });
  for (var d = 0; d < toDelete.length; d++) {
    sheet.deleteRow(toDelete[d]);
  }
  
  // Перечитываем данные после удаления
  data = sheet.getDataRange().getValues();
  existingBySize = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() !== idStr) continue;
    var size = String(data[i][3] || '').trim();
    var qty = Number(data[i][4]) || 0;
    existingBySize[size] = { rowIndex: i + 1, quantity: qty };
  }
  
  var updated = 0;
  var added = 0;
  var rowsToAdd = [];
  
  // Обрабатываем каждый продукт
  for (var p = 0; p < products.length; p++) {
    var prod = products[p];
    var size = String(prod.size || '').trim();
    var addQty = Number(prod.quantity) || 0;
    var existing = existingBySize[size];
    
    if (existing) {
      // Обновляем существующую строку: setQuantity = true значит "установить", иначе "прибавить"
      var rowUpdate = createRow(prod);
      var setQuantity = prod.setQuantity === true;
      if (setQuantity) {
        rowUpdate[4] = Number(prod.quantity) || 0;
      } else {
        rowUpdate[4] = existing.quantity + addQty;
      }
      
      var updateRange = sheet.getRange(existing.rowIndex, 1, 1, 14);
      for (var col = 1; col <= 14; col++) {
        updateRange.getCell(1, col).setValue(rowUpdate[col - 1]);
      }
      updated++;
    } else {
      // Собираем новые строки для batch добавления
      var rowNew = createRow(prod);
      rowNew[4] = addQty;
      rowsToAdd.push(rowNew);
    }
  }
  
  if (rowsToAdd.length > 0) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 1) lastRow = 1;
    sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 14).setValues(rowsToAdd);
    added = rowsToAdd.length;
  }

  return { updated: updated, added: added };
}

function handleBulkImport(sheet, rows) {
  try {
    var data = sheet.getDataRange().getValues();

    // Build index: key(id_size) -> row number (1-based)
    var index = {};
    for (var i = 1; i < data.length; i++) {
      var id = String(data[i][0] || '').trim();
      var size = String(data[i][3] || '').trim();
      var key = size ? id + '_' + size : id;
      if (id) {
        index[key] = i + 1;
      }
    }

    var updated = 0;
    var added = 0;
    var rowsToAdd = [];

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var rowId = String(row.id || '').trim();
      if (!rowId) continue;

      var rowSize = String(row.size || '').trim();
      var rowKey = rowSize ? rowId + '_' + rowSize : rowId;
      var newRow = createRow(row);

      if (index[rowKey]) {
        var rowNum = index[rowKey];
        sheet.getRange(rowNum, 1, 1, 14).setValues([newRow]);
        updated++;
      } else {
        rowsToAdd.push(newRow);
      }
    }

    if (rowsToAdd.length > 0) {
      var lastRow = sheet.getLastRow();
      if (lastRow < 1) lastRow = 1;
      var numRows = rowsToAdd.length;
      var numCols = 14;
      sheet.getRange(lastRow + 1, 1, numRows, numCols).setValues(rowsToAdd);
      added = numRows;
    }

    addLog("Массовый импорт", "Обновлено: " + updated + ", Добавлено: " + added + ", Всего строк в файле: " + rows.length, "Успех");

    return createResponse({
      result: "success",
      message: "Импорт завершён. Обновлено: " + updated + ", добавлено: " + added,
      updated: updated,
      added: added
    });
  } catch (e) {
    addLog("Массовый импорт", "Ошибка: " + e.toString(), "Ошибка");
    return createResponse({ result: "error", error: e.toString() });
  }
}

function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'getProducts') {
    return getProducts();
  }
  if (action === 'getStats') {
    return getStats();
  }
  if (action === 'getCategories') {
    return getCategories();
  }
  if (action === 'getSizes') {
    return getSizes();
  }
  if (action === 'getCapsules') {
    return getCapsules();
  }
  if (action === 'getLogs') {
    var limit = e.parameter.limit ? parseInt(e.parameter.limit, 10) : 100;
    return getLogs(limit);
  }
  if (action === 'getOrders') {
    return getOrders();
  }
  
  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: "OK", 
      message: "Скрипт работает! Используйте POST для управления товарами.",
      endpoints: {
        "POST": "Добавление/редактирование/удаление товаров, категорий, размеров и капсул",
        "GET ?action=getProducts": "Получить список товаров",
        "GET ?action=getStats": "Получить статистику",
        "GET ?action=getCategories": "Получить список категорий",
        "GET ?action=getSizes": "Получить список размеров",
        "GET ?action=getCapsules": "Получить список капсул",
        "GET ?action=getLogs&limit=100": "Получить логи действий"
      }
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getProducts() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Merch");
    if (!sheet) {
      return createResponse({ result: "error", error: "Лист 'Merch' не найден" });
    }
    
    var data = sheet.getDataRange().getValues();
    var products = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0]) {
        var preorderVal = row[12];
        var disabledVal = row[13];
        products.push({
          id: row[0],
          category: row[1],
          name: row[2],
          size: row[3],
          quantity: row[4],
          price: row[5],
          image1: row[6],
          image2: row[7],
          image3: row[8],
          image4: row[9],
          capsule: row[10],
          description: row[11],
          preorder: preorderVal === true || preorderVal === 'true' || preorderVal === 'да' || preorderVal === 1,
          disabled: disabledVal === true || disabledVal === 'true' || disabledVal === 'да' || disabledVal === 1
        });
      }
    }
    
    return createResponse({ result: "success", products: products, count: products.length });
  } catch(error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

// ============================================
// Операции с размерами
// ============================================

function getSizes() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Размеры");
    
    // Если лист не существует - создаём его
    if (!sheet) {
      sheet = ss.insertSheet("Размеры");
      sheet.getRange(1, 1).setValue("Название");
      sheet.setColumnWidth(1, 150);
    }
    
    var data = sheet.getDataRange().getValues();
    var sizes = [];
    
    for (var i = 1; i < data.length; i++) {
      var name = String(data[i][0] || '').trim();
      if (name) {
        sizes.push(name);
      }
    }
    
    return createResponse({ result: "success", sizes: sizes });
  } catch(error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

function addSize(sizeName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Размеры");
    
    // Если лист не существует - создаём его
    if (!sheet) {
      sheet = ss.insertSheet("Размеры");
      sheet.getRange(1, 1).setValue("Название");
      sheet.setColumnWidth(1, 150);
    }
    
    var name = String(sizeName || '').trim();
    if (!name) {
      addLog("Добавление размера", "Пустое название размера", "Ошибка");
      return createResponse({ result: "error", error: "Название размера не может быть пустым" });
    }
    
    // Проверяем, не существует ли уже такой размер
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toLowerCase() === name.toLowerCase()) {
        addLog("Добавление размера", "Размер '" + name + "' уже существует", "Ошибка");
        return createResponse({ result: "error", error: "Размер уже существует" });
      }
    }
    
    // Добавляем новый размер
    sheet.appendRow([name]);
    addLog("Добавление размера", "Размер: " + name, "Успех");
    
    return createResponse({ result: "success", message: "Размер добавлен", sizeName: name });
  } catch(error) {
    addLog("Добавление размера", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function deleteSize(sizeName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sizeSheet = ss.getSheetByName("Размеры");
    var merchSheet = ss.getSheetByName("Merch");
    
    if (!sizeSheet) {
      addLog("Удаление размера", "Лист 'Размеры' не найден", "Ошибка");
      return createResponse({ result: "error", error: "Лист 'Размеры' не найден" });
    }
    
    var name = String(sizeName || '').trim();
    if (!name) {
      return createResponse({ result: "error", error: "Название размера не может быть пустым" });
    }
    
    // Проверяем, используется ли размер в товарах
    if (merchSheet) {
      var merchData = merchSheet.getDataRange().getValues();
      var productsWithSize = [];
      
      for (var i = 1; i < merchData.length; i++) {
        var productSize = String(merchData[i][3] || '').trim();
        if (productSize.toLowerCase() === name.toLowerCase()) {
          var productId = String(merchData[i][0] || '');
          if (productsWithSize.indexOf(productId) === -1) {
            productsWithSize.push(productId);
          }
        }
      }
      
      if (productsWithSize.length > 0) {
        addLog("Удаление размера", "Размер '" + name + "' используется в " + productsWithSize.length + " товарах", "Ошибка");
        return createResponse({ 
          result: "error", 
          error: "Размер используется в товарах", 
          productsCount: productsWithSize.length,
          productIds: productsWithSize 
        });
      }
    }
    
    // Ищем и удаляем размер
    var sizeData = sizeSheet.getDataRange().getValues();
    for (var i = sizeData.length - 1; i >= 1; i--) {
      if (String(sizeData[i][0] || '').trim().toLowerCase() === name.toLowerCase()) {
        sizeSheet.deleteRow(i + 1);
        addLog("Удаление размера", "Размер: " + name, "Успех");
        return createResponse({ result: "success", message: "Размер удалён" });
      }
    }
    
    addLog("Удаление размера", "Размер '" + name + "' не найден", "Ошибка");
    return createResponse({ result: "error", error: "Размер не найден" });
  } catch(error) {
    addLog("Удаление размера", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function getStats() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Merch");
    if (!sheet) {
      return createResponse({ result: "error", error: "Лист 'Merch' не найден" });
    }
    
    var data = sheet.getDataRange().getValues();
    var stats = {
      totalRows: data.length - 1,
      uniqueProducts: 0,
      totalStock: 0,
      byCapsule: {},
      byCategory: {}
    };
    var uniqueIds = {};
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0];
      var quantity = parseInt(row[4], 10) || 0;
      var capsule = row[10] || "Без капсулы";
      var category = row[1] || "Без категории";
      
      if (id && !uniqueIds[id]) {
        uniqueIds[id] = true;
        stats.uniqueProducts++;
      }
      stats.totalStock += quantity;
      
      if (!stats.byCapsule[capsule]) {
        stats.byCapsule[capsule] = { count: 0, stock: 0 };
      }
      stats.byCapsule[capsule].count++;
      stats.byCapsule[capsule].stock += quantity;
      
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { count: 0, stock: 0 };
      }
      stats.byCategory[category].count++;
      stats.byCategory[category].stock += quantity;
    }
    
    return createResponse({ result: "success", stats: stats });
  } catch(error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

// ============================================
// Операции с категориями
// ============================================

function getCategories() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Категории");
    
    // Если лист не существует - создаём его
    if (!sheet) {
      sheet = ss.insertSheet("Категории");
      sheet.getRange(1, 1).setValue("Название");
      sheet.setColumnWidth(1, 200);
    }
    
    var data = sheet.getDataRange().getValues();
    var categories = [];
    
    for (var i = 1; i < data.length; i++) {
      var name = String(data[i][0] || '').trim();
      if (name) {
        categories.push(name);
      }
    }
    
    return createResponse({ result: "success", categories: categories });
  } catch(error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

function addCategory(categoryName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Категории");
    
    // Если лист не существует - создаём его
    if (!sheet) {
      sheet = ss.insertSheet("Категории");
      sheet.getRange(1, 1).setValue("Название");
      sheet.setColumnWidth(1, 200);
    }
    
    var name = String(categoryName || '').trim();
    if (!name) {
      addLog("Добавление категории", "Пустое название категории", "Ошибка");
      return createResponse({ result: "error", error: "Название категории не может быть пустым" });
    }
    
    // Проверяем, не существует ли уже такая категория
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toLowerCase() === name.toLowerCase()) {
        addLog("Добавление категории", "Категория '" + name + "' уже существует", "Ошибка");
        return createResponse({ result: "error", error: "Категория уже существует" });
      }
    }
    
    // Добавляем новую категорию
    sheet.appendRow([name]);
    addLog("Добавление категории", "Категория: " + name, "Успех");
    
    return createResponse({ result: "success", message: "Категория добавлена", categoryName: name });
  } catch(error) {
    addLog("Добавление категории", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function deleteCategory(categoryName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var categorySheet = ss.getSheetByName("Категории");
    var merchSheet = ss.getSheetByName("Merch");
    
    if (!categorySheet) {
      addLog("Удаление категории", "Лист 'Категории' не найден", "Ошибка");
      return createResponse({ result: "error", error: "Лист 'Категории' не найден" });
    }
    
    var name = String(categoryName || '').trim();
    if (!name) {
      return createResponse({ result: "error", error: "Название категории не может быть пустым" });
    }
    
    // Проверяем, используется ли категория в товарах
    if (merchSheet) {
      var merchData = merchSheet.getDataRange().getValues();
      var productsWithCategory = [];
      
      for (var i = 1; i < merchData.length; i++) {
        var productCategory = String(merchData[i][1] || '').trim();
        if (productCategory.toLowerCase() === name.toLowerCase()) {
          var productId = String(merchData[i][0] || '');
          var productName = String(merchData[i][2] || '');
          if (productsWithCategory.indexOf(productId) === -1) {
            productsWithCategory.push(productId);
          }
        }
      }
      
      if (productsWithCategory.length > 0) {
        addLog("Удаление категории", "Категория '" + name + "' используется в " + productsWithCategory.length + " товарах", "Ошибка");
        return createResponse({ 
          result: "error", 
          error: "Категория используется в товарах", 
          productsCount: productsWithCategory.length,
          productIds: productsWithCategory 
        });
      }
    }
    
    // Ищем и удаляем категорию
    var categoryData = categorySheet.getDataRange().getValues();
    for (var i = categoryData.length - 1; i >= 1; i--) {
      if (String(categoryData[i][0] || '').trim().toLowerCase() === name.toLowerCase()) {
        categorySheet.deleteRow(i + 1);
        addLog("Удаление категории", "Категория: " + name, "Успех");
        return createResponse({ result: "success", message: "Категория удалена" });
      }
    }
    
    addLog("Удаление категории", "Категория '" + name + "' не найдена", "Ошибка");
    return createResponse({ result: "error", error: "Категория не найдена" });
  } catch(error) {
    addLog("Удаление категории", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

// ============================================
// Операции с капсулами
// ============================================

function getCapsules() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Капсулы");
    
    // Если лист не существует - создаём его с новой структурой
    if (!sheet) {
      sheet = ss.insertSheet("Капсулы");
      sheet.getRange(1, 1, 1, 4).setValues([["Название", "Цвет", "Префикс", "Обводка"]]);
      sheet.setColumnWidth(1, 200);
      sheet.setColumnWidth(2, 100);
      sheet.setColumnWidth(3, 150);
      sheet.setColumnWidth(4, 80);
    } else {
      // Проверяем, есть ли новые колонки, если нет - добавляем заголовки
      var headers = sheet.getRange(1, 1, 1, 4).getValues()[0];
      if (!headers[1] || headers[1] !== "Цвет") {
        sheet.getRange(1, 2).setValue("Цвет");
        sheet.setColumnWidth(2, 100);
      }
      if (!headers[2] || headers[2] !== "Префикс") {
        sheet.getRange(1, 3).setValue("Префикс");
        sheet.setColumnWidth(3, 150);
      }
      if (!headers[3] || headers[3] !== "Обводка") {
        sheet.getRange(1, 4).setValue("Обводка");
        sheet.setColumnWidth(4, 80);
      }
    }
    
    var data = sheet.getDataRange().getValues();
    var capsules = [];
    
    for (var i = 1; i < data.length; i++) {
      var name = String(data[i][0] || '').trim();
      if (name) {
        var outlineVal = data[i][3];
        capsules.push({
          name: name,
          color: String(data[i][1] || '').trim() || '#0047BB',
          prefix: String(data[i][2] || '').trim() || 'Капсула',
          outline: outlineVal === true || outlineVal === 'true' || outlineVal === 'да' || outlineVal === 1
        });
      }
    }
    
    return createResponse({ result: "success", capsules: capsules });
  } catch(error) {
    return createResponse({ result: "error", error: error.toString() });
  }
}

function addCapsule(capsuleName, color, prefix, outline) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Капсулы");
    
    // Если лист не существует - создаём его с новой структурой
    if (!sheet) {
      sheet = ss.insertSheet("Капсулы");
      sheet.getRange(1, 1, 1, 4).setValues([["Название", "Цвет", "Префикс", "Обводка"]]);
      sheet.setColumnWidth(1, 200);
      sheet.setColumnWidth(2, 100);
      sheet.setColumnWidth(3, 150);
      sheet.setColumnWidth(4, 80);
    }
    
    var name = String(capsuleName || '').trim();
    if (!name) {
      addLog("Добавление капсулы", "Пустое название капсулы", "Ошибка");
      return createResponse({ result: "error", error: "Название капсулы не может быть пустым" });
    }
    
    var capsuleColor = String(color || '').trim() || '#0047BB';
    var capsulePrefix = String(prefix || '').trim() || 'Капсула';
    var capsuleOutline = outline === true || outline === 'true';
    
    // Проверяем, не существует ли уже такая капсула
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toLowerCase() === name.toLowerCase()) {
        addLog("Добавление капсулы", "Капсула '" + name + "' уже существует", "Ошибка");
        return createResponse({ result: "error", error: "Капсула уже существует" });
      }
    }
    
    // Добавляем новую капсулу с цветом, префиксом и обводкой
    sheet.appendRow([name, capsuleColor, capsulePrefix, capsuleOutline]);
    addLog("Добавление капсулы", "Капсула: " + name + ", цвет: " + capsuleColor + ", обводка: " + capsuleOutline, "Успех");
    
    return createResponse({ 
      result: "success", 
      message: "Капсула добавлена", 
      capsule: { name: name, color: capsuleColor, prefix: capsulePrefix, outline: capsuleOutline }
    });
  } catch(error) {
    addLog("Добавление капсулы", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function updateCapsule(capsuleName, color, prefix, outline) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Капсулы");
    
    if (!sheet) {
      addLog("Обновление капсулы", "Лист 'Капсулы' не найден", "Ошибка");
      return createResponse({ result: "error", error: "Лист 'Капсулы' не найден" });
    }
    
    var name = String(capsuleName || '').trim();
    if (!name) {
      return createResponse({ result: "error", error: "Название капсулы не может быть пустым" });
    }
    
    var capsuleColor = String(color || '').trim() || '#0047BB';
    var capsulePrefix = String(prefix || '').trim() || 'Капсула';
    var capsuleOutline = outline === true || outline === 'true';
    
    // Ищем капсулу и обновляем
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toLowerCase() === name.toLowerCase()) {
        // Обновляем цвет, префикс и обводку (колонки B, C, D)
        sheet.getRange(i + 1, 2).setValue(capsuleColor);
        sheet.getRange(i + 1, 3).setValue(capsulePrefix);
        sheet.getRange(i + 1, 4).setValue(capsuleOutline);
        addLog("Обновление капсулы", "Капсула: " + name + ", цвет: " + capsuleColor + ", обводка: " + capsuleOutline, "Успех");
        return createResponse({ 
          result: "success", 
          message: "Капсула обновлена",
          capsule: { name: name, color: capsuleColor, prefix: capsulePrefix, outline: capsuleOutline }
        });
      }
    }
    
    addLog("Обновление капсулы", "Капсула '" + name + "' не найдена", "Ошибка");
    return createResponse({ result: "error", error: "Капсула не найдена" });
  } catch(error) {
    addLog("Обновление капсулы", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}

function deleteCapsule(capsuleName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var capsuleSheet = ss.getSheetByName("Капсулы");
    var merchSheet = ss.getSheetByName("Merch");
    
    if (!capsuleSheet) {
      addLog("Удаление капсулы", "Лист 'Капсулы' не найден", "Ошибка");
      return createResponse({ result: "error", error: "Лист 'Капсулы' не найден" });
    }
    
    var name = String(capsuleName || '').trim();
    if (!name) {
      return createResponse({ result: "error", error: "Название капсулы не может быть пустым" });
    }
    
    // Проверяем, используется ли капсула в товарах (колонка 10 - capsule)
    if (merchSheet) {
      var merchData = merchSheet.getDataRange().getValues();
      var productsWithCapsule = [];
      
      for (var i = 1; i < merchData.length; i++) {
        var productCapsule = String(merchData[i][10] || '').trim();
        if (productCapsule.toLowerCase() === name.toLowerCase()) {
          var productId = String(merchData[i][0] || '');
          if (productsWithCapsule.indexOf(productId) === -1) {
            productsWithCapsule.push(productId);
          }
        }
      }
      
      if (productsWithCapsule.length > 0) {
        addLog("Удаление капсулы", "Капсула '" + name + "' используется в " + productsWithCapsule.length + " товарах", "Ошибка");
        return createResponse({ 
          result: "error", 
          error: "Капсула используется в товарах", 
          productsCount: productsWithCapsule.length,
          productIds: productsWithCapsule 
        });
      }
    }
    
    // Ищем и удаляем капсулу
    var capsuleData = capsuleSheet.getDataRange().getValues();
    for (var i = capsuleData.length - 1; i >= 1; i--) {
      if (String(capsuleData[i][0] || '').trim().toLowerCase() === name.toLowerCase()) {
        capsuleSheet.deleteRow(i + 1);
        addLog("Удаление капсулы", "Капсула: " + name, "Успех");
        return createResponse({ result: "success", message: "Капсула удалена" });
      }
    }
    
    addLog("Удаление капсулы", "Капсула '" + name + "' не найдена", "Ошибка");
    return createResponse({ result: "error", error: "Капсула не найдена" });
  } catch(error) {
    addLog("Удаление капсулы", "Ошибка: " + error.toString(), "Ошибка");
    return createResponse({ result: "error", error: error.toString() });
  }
}
