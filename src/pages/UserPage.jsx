import {
  BrowserRouter,
  Routes,
  Route,
  Link,
   Navigate
} from "react-router-dom";

function Images() {
    // TODO: Implement the Images component to display images based on themes (animals, food, cities, nature views). Also include the functionality to search image by name or theme (and to upload image if time permits).
    return <h2>Images</h2>;
}

function Home() {
  return (
    <div>
      <h1>Image Management (or I-Management)</h1>
      <h2>Welome to the Image Management, or I-Management, portal.</h2>
      <p>Here you can find all images of various themes, such as animals, food, and, cities, and nature views. Navigate to the Images tab to search for these images.</p>
    </div>
  );
}

export default function UserPage() {
    return(
        <BrowserRouter>
            <nav>
                <ul>
                    <li>
                        <Link to="/">Home</Link>
                    </li>
                    <li>
                        <Link to="/images">Images</Link>
                    </li>
                </ul>
            </nav>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="*" element={<Navigate to="/" />} />
                <Route path="/images" element={<Images />} />
            </Routes>
        </BrowserRouter>
    );
}
