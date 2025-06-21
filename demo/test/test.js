// Test file to demonstrate the split-js-file functionality

function greetUser(name) {
  return `Hello, ${name}! Welcome to our application.`;
}

const calculateSum = function (a, b) {
  return a + b;
};

const multiplyNumbers = (x, y) => {
  return x * y;
};

const divideNumbers = (a, b) => {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
};

class Telephone {
  constructor() {
    this.number = [];
  }

  add(a, b) {
    const result = a + b;
    this.number.push(`${a} + ${b} = ${result}`);
    return result;
  }

  subtract(a, b) {
    const result = a - b;
    this.number.push(`${a} - ${b} = ${result}`);
    return result;
  }

  getnumber() {
    return this.number;
  }
}

class Calculator {
  constructor() {
    this.history = [];
  }

  add(a, b) {
    const result = a + b;
    this.history.push(`${a} + ${b} = ${result}`);
    return result;
  }

  subtract(a, b) {
    const result = a - b;
    this.history.push(`${a} - ${b} = ${result}`);
    return result;
  }

  getHistory() {
    return this.history;
  }
}

class MathUtils {
  static square(n) {
    return n * n;
  }

  static cube(n) {
    return n * n * n;
  }
}

function performCalculations() {
  const calc = new Calculator();

  console.log("Basic calculations:");
  console.log(greetUser("Developer"));
  console.log("Sum:", calculateSum(5, 3));
  console.log("Product:", multiplyNumbers(4, 7));
  console.log("Division:", divideNumbers(15, 3));

  console.log("\nUsing Calculator class:");
  console.log("Addition:", calc.add(10, 5));
  console.log("Subtraction:", calc.subtract(10, 3));

  console.log("\nUsing MathUtils:");
  console.log("Square of 5:", MathUtils.square(5));
  console.log("Cube of 3:", MathUtils.cube(3));

  console.log("\nCalculator history:");
  calc.getHistory().forEach((entry) => console.log(entry));
}

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    greetUser,
    calculateSum,
    multiplyNumbers,
    divideNumbers,
    Calculator,
    Telephone,
    MathUtils,
    performCalculations,
  };
}
