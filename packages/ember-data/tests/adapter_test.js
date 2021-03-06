var get = SC.get, set = SC.set, getPath = SC.getPath;

var Person, store, adapter;

module("DS.Adapter", {
  setup: function() {
    Person = DS.Model.extend({
      updatedAt: DS.attr('string')
    });

    adapter = DS.Adapter.create();
    store = DS.Store.create({ adapter: adapter });
  }
});

test("when a single record is requested, the adapter's find method is called unless it's loaded", function() {
  expect(2);

  var count = 0;

  adapter.find = function(store, type, id) {
    equals(type, Person, "the find method is called with the correct type");
    equals(count, 0, "the find method is only called once");

    store.load(type, id, { id: 1, name: "Braaaahm Dale" });

    count++;
  };

  store.find(Person, 1);
  store.find(Person, 1);
});

test("when multiple models are requested, the adapter's findMany method is called", function() {
  expect(1);

  adapter.findMany = function(store, type, ids) {
    deepEqual(ids, [1,2,3], "ids are passed");
  };

  store.findMany(Person, [1,2,3]);
  store.findMany(Person, [1,2,3]);
});

test("when multiple models are requested, the adapter's find method is called multiple times if findMany is not implemented", function() {
  expect(3);

  var count = 0;
  adapter.find = function(store, type, id) {
    count++;

    equal(id, count);
  };

  store.findMany(Person, [1,2,3]);
  store.findMany(Person, [1,2,3]);
});

test("when many records are requested with query parameters, the adapter's findQuery method is called", function() {
  expect(6);

  adapter.findQuery = function(store, type, query, modelArray) {
    equal(type, Person, "the find method is called with the correct type");

    stop();

    setTimeout(function() {
      modelArray.load([{ id: 1, name: "Peter Wagenet" }, { id: 2, name: "Brohuda Katz" }]);
      start();
    }, 100);
  };

  var array = store.find(Person, { page: 1 });
  equal(get(array, 'length'), 0, "The array is 0 length do far");

  array.addArrayObserver(this, {
    willChange: function(target, start, removed, added) {
      equal(removed, 0, "0 items are being removed");
    },

    didChange: function(target, start, removed, added) {
      equal(added, 2, "2 items are being added");

      equal(get(array, 'length'), 2, "The array is now populated");
      equal(get(array.objectAt(0), 'name'), "Peter Wagenet", "The array is populated correctly");
    }
  });
});

test("when all records for a type are requested, the adapter's findAll method is called", function() {
  expect(2);

  adapter.findAll = function(store, type) {
    stop();

    setTimeout(function() {
      start();

      store.load(type, { id: 1, name: "Braaaahm Dale" });
      equal(get(array, 'length'), 1, "The array is now 1 length");
    }, 100);
  };

  var array = store.findAll(Person);
  equal(get(array, 'length'), 0, "The array is 0 length do far");
});

test("when a store is committed, the adapter's commit method is called with updates", function() {
  expect(2);

  adapter.commit = function(store, records) {
    records.updated.eachType(function(type, array) {
      equal(type, Person, "the type is correct");
      equal(get(array, 'length'), 1, "the array is the right length");
      store.didUpdateModels(array);
    });
  };

  store.load(Person, { id: 1, name: "Braaaahm Dale" });
  var tom = store.find(Person, 1);

  set(tom, "name", "Tom Dale");

  store.commit();

  // there is nothing to commit, so eachType won't do anything
  store.commit();
});

test("when a store is committed, the adapter's commit method is called with creates", function() {
  expect(3);

  adapter.commit = function(store, records) {
    records.updated.eachType(function() {
      ok(false, "updated should not be populated");
    });

    records.created.eachType(function(type, array) {
      equal(type, Person, "the type is correct");
      equal(get(array, 'length'), 1, "the array is the right length");
      store.didCreateModels(Person, array, [{ id: 1, name: "Tom Dale" }])
    });
  };

  var tom = store.create(Person, { name: "Tom Dale" });

  store.commit();

  equal(tom, store.find(Person, 1), "Once an ID is in, find returns the same object");

  store.commit();
});

test("when a store is committed, the adapter's commit method is called with deletes", function() {
  expect(3);

  adapter.commit = function(store, records) {
    records.updated.eachType(function() {
      ok(false, "updated should not be populated");
    });

    records.created.eachType(function() {
      ok(false, "updated should not be populated");
    });

    records.deleted.eachType(function(type, array) {
      equal(type, Person, "the type is correct");
      equal(get(array, 'length'), 1, "the array is the right length");
      store.didDeleteModels(array)
    });
  };

  store.load(Person, { id: 1, name: "Tom Dale" });
  var tom = store.find(Person, 1);

  tom.deleteModel();
  store.commit();

  equal(get(tom, 'isDeleted'), true, "model is marked as deleted");
});

test("by default, commit calls createMany once per type", function() {
  expect(6);

  adapter.createMany = function(store, type, array) {
    equal(type, Person, "the type is correct");
    equal(get(array, 'length'), 2, "the array is the right length");
    var records = [{ id: 1, name: "Tom Dale", updatedAt: 'right nao' }, { id: 2, name: "Yehuda Katz" }];
    store.didCreateModels(Person, array, records);
  };

  var tom = store.create(Person, { name: "Tom Dale", updatedAt: null });
  var yehuda = store.create(Person, { name: "Yehuda Katz" });

  var callCount = 0;
  tom.addObserver('updatedAt', function() {
    callCount++;
    equal(get(tom, 'updatedAt'), 'right nao', "property returned from adapter is updated");
  });

  store.commit();
  equal(callCount, 1, "calls observer on the model when it has been changed");

  equal(tom, store.find(Person, 1), "Once an ID is in, find returns the same object");
  equal(yehuda, store.find(Person, 2), "Once an ID is in, find returns the same object");
  store.commit();
});

test("by default, commit calls updateMany once per type", function() {
  expect(3);

  adapter.updateMany = function(store, type, array) {
    equal(type, Person, "the type is correct");
    equal(get(array, 'length'), 2, "the array is the right length");
    store.didUpdateModels(array);
  };

  store.load(Person, { id: 1, name: "Braaaahm Dale" });
  store.load(Person, { id: 2, name: "Gentile Katz" });

  var tom = store.find(Person, 1);
  var yehuda = store.find(Person, 2);

  set(tom, "name", "Tom Dale");
  set(yehuda, "name", "Yehuda Katz");

  store.commit();

  equal(get(store.find(Person, 2), "name"), "Yehuda Katz", "model was updated");

  // there is nothing to commit, so eachType won't do anything
  store.commit();
});

test("by default, commit calls deleteMany once per type", function() {
  expect(4);

  adapter.deleteMany = function(store, type, array) {
    equal(type, Person, "the type is correct");
    equal(get(array, 'length'), 2, "the array is the right length");
    store.didDeleteModels(array);
  };

  store.load(Person, { id: 1, name: "Braaaahm Dale" });
  store.load(Person, { id: 2, name: "Gentile Katz" });

  var tom = store.find(Person, 1);
  var yehuda = store.find(Person, 2);

  tom.deleteModel();
  yehuda.deleteModel();
  store.commit();

  ok(get(tom, 'isDeleted'), "model is marked as deleted");
  ok(!get(tom, 'isDirty'), "model is marked as not being dirty");

  // there is nothing to commit, so eachType won't do anything
  store.commit();
});

test("by default, createMany calls create once per record", function() {
  expect(6);
  var count = 1;

  adapter.create = function(store, type, model) {
    equal(type, Person, "the type is correct");

    if (count === 1) {
      equal(get(model, 'name'), "Tom Dale");
    } else if (count === 2) {
      equal(get(model, 'name'), "Yehuda Katz");
    } else {
      ok(false, "should not have invoked more than 2 times");
    }

    var hash = get(model, 'data');
    hash.id = count;

    store.didCreateModel(model, hash);
    count++;
  };

  var tom = store.create(Person, { name: "Tom Dale" });
  var yehuda = store.create(Person, { name: "Yehuda Katz" });

  store.commit();
  equal(tom, store.find(Person, 1), "Once an ID is in, find returns the same object");
  equal(yehuda, store.find(Person, 2), "Once an ID is in, find returns the same object");
  store.commit();
});

test("by default, updateMany calls update once per record", function() {
  expect(4);

  var count = 0;

  adapter.update = function(store, type, model) {
    equal(type, Person, "the type is correct");

    if (count === 0) {
      equal(get(model, 'name'), "Tom Dale");
    } else if (count === 1) {
      equal(get(model, 'name'), "Yehuda Katz");
    } else {
      ok(false, "should not get here");
    }

    count++;

    store.didUpdateModel(model);
  };

  store.load(Person, { id: 1, name: "Braaaahm Dale" });
  store.load(Person, { id: 2, name: "Brohuda Katz" });

  var tom = store.find(Person, 1);
  var yehuda = store.find(Person, 2);

  set(tom, "name", "Tom Dale");
  set(yehuda, "name", "Yehuda Katz");

  store.commit();

  // there is nothing to commit, so eachType won't do anything
  store.commit();
});

test("by default, deleteMany calls deleteModel once per record", function() {
  expect(4);

  var count = 0;

  adapter.deleteModel = function(store, type, model) {
    equal(type, Person, "the type is correct");

    if (count === 0) {
      equal(get(model, 'name'), "Tom Dale");
    } else if (count === 1) {
      equal(get(model, 'name'), "Yehuda Katz");
    } else {
      ok(false, "should not get here");
    }

    count++;

    store.didDeleteModel(model);
  };

  store.load(Person, { id: 1, name: "Tom Dale" });
  store.load(Person, { id: 2, name: "Yehuda Katz" });

  var tom = store.find(Person, 1);
  var yehuda = store.find(Person, 2);

  tom.deleteModel();
  yehuda.deleteModel();
  store.commit();

  // there is nothing to commit, so eachType won't do anything
  store.commit();
});

