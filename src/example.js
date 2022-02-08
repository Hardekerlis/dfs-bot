// The data
const airports = 'PHX BKK OKC JFK LAX MEX EZE HEL LOS LIM'.split(' ');

const routes = [
  ['PHX', 'LAX'],
  ['PHX', 'JFK'],
  ['JFK', 'OKC'],
  ['JFK', 'HEL'],
  ['JFK', 'LOS'],
  ['MEX', 'LAX'],
  ['MEX', 'BKK'],
  ['MEX', 'LIM'],
  ['MEX', 'EZE'],
  ['LIM', 'BKK'],
];

// The graph
const adjecencyList = new Map();

const addNode = (airport) => {
  adjecencyList.set(airport, []);
};

const addEdge = (origin, destination) => {
  adjecencyList.get(origin).push(destination);
  adjecencyList.get(destination).push(origin);
};

airports.forEach(addNode);
routes.forEach((route) => addEdge(...route));

const sleep = async (ms) => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

console.log(adjecencyList);

// return;

// Bread first search
const bfs = async (start) => {
  const visited = new Set();

  const queue = [start];

  while (queue.length > 0) {
    const airport = queue.shift();

    const destinations = adjecencyList.get(airport);

    for (const destination of destinations) {
      // queue.push(destination);

      if (destination === 'BKK') {
        console.log('Found it');
      }

      if (!visited.has(destination)) {
        visited.add(destination);
        queue.push(destination);
        console.log(destination);
      }
      // await sleep(1000);
    }
  }
};

// bfs('PHX');
let stop = false;
// Depth first search
const dfs = (start, visited = new Set()) => {
  if (stop) return;
  console.log(start);

  visited.add(start);

  const destinations = adjecencyList.get(start);

  for (const destination of destinations) {
    if (destination === 'BKK') {
      console.log('DFS found Bangkok in steps');
      stop = true;
      return;
    }

    if (!visited.has(destination)) {
      dfs(destination, visited);
    }
  }
};

dfs('PHX');
