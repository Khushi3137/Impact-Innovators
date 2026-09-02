import { useState } from "react";

const cards = [
  {
    q: "What is Artificial Intelligence?",
    a: "Artificial Intelligence is the simulation of human intelligence in machines.",
  },
  {
    q: "What is React?",
    a: "React is a JavaScript library for building user interfaces.",
  },
  {
    q: "What is MongoDB?",
    a: "MongoDB is a NoSQL database that stores data in JSON-like documents.",
  },
];

export default function Flashcards() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Flashcards</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <Flashcard key={i} {...card} />
        ))}
      </div>
    </div>
  );
}
function Flashcard({ q, a }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="h-56 w-full cursor-pointer perspective"
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className={`relative h-full w-full rounded-xl transition-transform duration-500 transform-3d ${
          flipped ? "rotate-y-180" : ""
        }`}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 bg-white rounded-xl shadow-md p-5 backface-hidden flex items-center justify-center border border-gray-100">
          <p className="text-center font-medium text-gray-800">
            {q}
          </p>
        </div>

        {/* BACK SIDE */}
        <div 
          className="absolute inset-0 bg-indigo-600 text-white rounded-xl shadow-md p-5 backface-hidden flex items-center justify-center"
          style={{ transform: "rotateY(180deg)" }} // Explicitly set rotation for the back face
        >
          <p className="text-center leading-relaxed">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}
// function Flashcard({ q, a }) {
//   const [flipped, setFlipped] = useState(false);

//   return (
//     <div
//       className="h-56 w-full cursor-pointer perspective"
//       onClick={() => setFlipped(!flipped)}
//     >
//       <div
//         className={`relative h-full w-full rounded-xl transition-transform duration-500 transform-style-preserve-3d ${
//           flipped ? "rotate-y-180" : ""
//         }`}
//       >
//         {/* FRONT */}
//         <div className="absolute inset-0 bg-white rounded-xl shadow-md p-5 backface-hidden flex items-center justify-center">
//           <p className="text-center font-medium text-gray-800 leading-relaxed">
//             {q}
//           </p>
//         </div>

//         {/* BACK */}
//         <div className="absolute inset-0 bg-indigo-600 text-white rounded-xl shadow-md p-5 backface-hidden rotate-y-180 flex items-center justify-center">
//           <p className="text-center leading-relaxed">
//             {a}
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }

// import { useState } from "react";

// export default function Flashcards() {
//   const cards = [
//     { q: "What is React?", a: "A UI library" },
//     { q: "What is Tailwind?", a: "Utility-first CSS" },
//   ];

//   return (
//     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//       {cards.map((card, i) => (
//         <div
//           key={i}
//           className="bg-white rounded-lg shadow p-4"
//         >
//           <h3 className="font-semibold text-lg mb-2">
//             {card.q}
//           </h3>
//           <p className="text-gray-600">
//             {card.a}
//           </p>
//         </div>
//       ))}
//     </div>
//   );
// }
