import { ReactFlowProvider } from '@xyflow/react'
import Whiteboard from './whiteboard/Whiteboard'

function App() {
  return (
    <ReactFlowProvider>
      <Whiteboard />
    </ReactFlowProvider>
  )
}

export default App
