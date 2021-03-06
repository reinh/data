var get = SC.get, set = SC.set, getPath = SC.getPath;

module("DS.Model");

var modelIsInState = function(model, stateName) {
  var state = getPath(model, 'stateManager.currentState');
  ok(state, "precond - there is a current state");
  var expected = getPath(model, 'stateManager.states.rootState.' + stateName);
  equals(state, expected, "the current state should be " + stateName);
};

test("a new DS.Model is in the empty state", function() {
  var model = DS.Model.create();
  modelIsInState(model, 'empty');
});

test("a DS.Model can receive data, which puts it into the loaded state", function() {
  var model = DS.Model.create();
  model.loadingData();
  model.setData({ scumbag: "tom" });
  modelIsInState(model, 'loaded');
});

var coercesType = function(type, provided, expected) {
  var model = DS.Model.create({
    name: DS.attr(type)
  });

  model.loadingData();
  model.setData({ name: provided });
  deepEqual(get(model, 'name'), expected, type + " coerces " + provided + " to " + expected);


  model = DS.Model.create({
    name: DS.attr(type)
  });

  model.loadingData();
  model.setData({});
  set(model, 'name', provided);
  deepEqual(get(model, 'name'), expected, type + " coerces " + provided + " to " + expected);
}

test("a DS.Model can describe String attributes", function() {
  coercesType('string', "Scumbag Tom", "Scumbag Tom");
  coercesType('string', 1, "1");
  coercesType('string', null, "null");
});

test("a DS.Model can describe Integer attributes", function() {
  coercesType('integer', "1", 1);
  coercesType('integer', "0", 0);
  coercesType('integer', 1, 1);
  coercesType('integer', 0, 0);
  coercesType('integer', null, 0);
  coercesType('integer', true, 1);
  coercesType('integer', false, 0);
});

test("a DS.Model can describe Boolean attributes", function() {
  coercesType('boolean', "1", true);
  coercesType('boolean', "", false);
  coercesType('boolean', 1, true);
  coercesType('boolean', 0, false);
  coercesType('boolean', null, false);
  coercesType('boolean', true, true);
  coercesType('boolean', false, false);
});

test("it can specify which key to use when looking up properties on the hash", function() {
  var model = DS.Model.create({
    name: DS.attr('string', { key: 'full_name' })
  });

  model.loadingData();
  model.setData({ name: "Steve", full_name: "Pete" });

  equals(get(model, 'name'), "Pete", "retrieves correct value");
});

var Person, store, array;

module("DS.Model updating", {
  setup: function() {
    array = [{ id: 1, name: "Scumbag Dale" }, { id: 2, name: "Scumbag Katz" }, { id: 3, name: "Scumbag Bryn" }];
    Person = DS.Model.extend({ name: DS.attr('string') });
    store = DS.Store.create();
    store.loadMany(Person, array);
  }
});

test("a DS.Model can update its attributes", function() {
  var person = store.find(Person, 2);

  set(person, 'name', "Brohuda Katz");
  equal(get(person, 'name'), "Brohuda Katz", "setting took hold");
});

test("it should modify the property of the hash specified by the `key` option", function() {
  var model = DS.Model.create({
    name: DS.attr('string', { key: 'full_name' })
  });

  model.loadingData();
  model.setData({ name: "Steve", full_name: "Pete" });

  model.set('name', "Colin");
  var data = model.get('data');
  equals(get(data, 'name'), "Steve", "did not modify name property");
  equals(get(data, 'full_name'), "Colin", "properly modified full_name property");
});

test("when a DS.Model updates its attributes, its changes affect its filtered Array membership", function() {
  var people = store.filter(Person, function(hash) {
    if (hash.name.match(/Katz$/)) { return true; }
  });

  equal(get(people, 'length'), 1, "precond - one item is in the ModelArray");

  var person = people.objectAt(0);

  equal(get(person, 'name'), "Scumbag Katz", "precond - the item is correct");

  set(person, 'name', "Yehuda Katz");

  equal(get(people, 'length'), 1, "there is still one item");
  equal(get(person, 'name'), "Yehuda Katz", "it has the updated item");

  set(person, 'name', "Yehuda Katz-Foo");

  equal(get(people, 'length'), 0, "there are now no items");
});

test("when a DS.Model updates its attributes, it is marked dirty and listed in the dirty queue", function() {
  expect(9);

  var yehuda = store.find(Person, 2);

  set(yehuda, 'name', "Yehuda Katz");
  equal(get(yehuda, 'isDirty'), true, "The person is now dirty");

  var dirty = get(store, 'updatedModels');

  store.eachDirtyType('updated', function(type, models) {
    equal(type, Person);
    equal(get(models, 'length'), 1, "The dirty list should be the right length");
    equal(get(models.objectAt(0), 'name'), "Yehuda Katz", "The dirty list should have the right item");
  });

  var tom = store.find(Person, 1);
  set(tom, 'name', "Tom Dale");

  equal(get(tom, 'isDirty'), true, "The person is now dirty");

  store.eachDirtyType('updated', function(type, models) {
    equal(type, Person);

    equal(get(models, 'length'), 2, "The dirty list should be the right length");
    equal(get(models.objectAt(1), 'name'), "Tom Dale", "The dirty list should have the right item");

    set(tom, 'name', "Senor Dale");
    equal(get(models, 'length'), 2, "Items don't get added multiple times");
  });
});

test("when a newly created DS.Model updates its attributes, it is still listed in the created queue", function() {
  expect(9);

  var yehuda = store.create(Person, { id: 2 });

  set(yehuda, 'name', "Yehuda Katz");
  equal(get(yehuda, 'isDirty'), true, "The person is now dirty");

  store.eachDirtyType('created', function(type, models) {
    equal(type, Person);
    equal(get(models, 'length'), 1, "The dirty list should be the right length");
    equal(get(models.objectAt(0), 'name'), "Yehuda Katz", "The dirty list should have the right item");
  });

  store.eachDirtyType('updated', function(type, models) {
    ok(false, "should not get here");
  });

  var tom = store.create(Person, { id: 1 });
  set(tom, 'name', "Tom Dale");

  equal(get(tom, 'isDirty'), true, "The person is now dirty");

  store.eachDirtyType('created', function(type, models) {
    equal(type, Person);

    equal(get(models, 'length'), 2, "The dirty list should be the right length");
    equal(get(models.objectAt(1), 'name'), "Tom Dale", "The dirty list should have the right item");

    set(tom, 'name', "Senor Dale");
    equal(get(models, 'length'), 2, "Items don't get added multiple times");
  });

  store.eachDirtyType('updated', function(type, models) {
    ok(false, "should not get here");
  });
});


test("when a DS.Model is dirty, attempting to `load` new data raises an exception", function() {
  var yehuda = store.find(Person, 2);
  set(yehuda, 'name', "Yehuda Katz");

  raises(function() {
    store.load(Person, 2, { id: 2, name: "Scumhuda Katz" });
  });
});

module("with a simple Person model", {
  setup: function() {
    array = [{ id: 1, name: "Scumbag Dale" }, { id: 2, name: "Scumbag Katz" }, { id: 3, name: "Scumbag Bryn" }];
    Person = DS.Model.extend();
    store = DS.Store.create();
    store.loadMany(Person, array);
  }
});

test("when a DS.Model updates its attributes, its changes affect its filtered Array membership", function() {
  var people = store.filter(Person, function(hash) {
    if (hash.name.match(/Katz$/)) { return true; }
  });

  equal(get(people, 'length'), 1, "precond - one item is in the ModelArray");

  var person = people.objectAt(0);

  equal(get(person, 'name'), "Scumbag Katz", "precond - the item is correct");

  set(person, 'name', "Yehuda Katz");

  equal(get(people, 'length'), 1, "there is still one item");
  equal(get(person, 'name'), "Yehuda Katz", "it has the updated item");

  set(person, 'name', "Yehuda Katz-Foo");

  equal(get(people, 'length'), 0, "there are now no items");
});
