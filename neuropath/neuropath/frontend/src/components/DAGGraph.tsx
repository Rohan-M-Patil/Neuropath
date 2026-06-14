import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { ConceptNodeOut } from '../lib/api'

interface Props {
  nodes: ConceptNodeOut[]
  edges: { source: string; target: string }[]
  onSelect: (node: ConceptNodeOut) => void
  selectedKey?: string
}

const STATUS_COLOR: Record<string, string> = {
  mastered: '#4ADE80',
  available: '#7C9CFF',
  in_progress: '#FFC95C',
  locked: '#3A4357',
}

export default function DAGGraph({ nodes, edges, onSelect, selectedKey }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const width = svgRef.current.clientWidth || 800
    const height = 480

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const simNodes = nodes.map((n) => ({ ...n, id: n.node_key }))
    const simLinks = edges.map((e) => ({ source: e.source, target: e.target }))

    const simulation = d3
      .forceSimulation(simNodes as any)
      .force('link', d3.forceLink(simLinks as any).id((d: any) => d.id).distance(140).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(46))

    const g = svg.append('g')

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 2])
        .on('zoom', (event) => g.attr('transform', event.transform)) as any
    )

    const link = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#2A3548')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)')

    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#2A3548')

    const node = g
      .append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<any, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }) as any
      )
      .on('click', (_, d: any) => onSelect(nodes.find((n) => n.node_key === d.id)!))

    node
      .append('circle')
      .attr('r', 22)
      .attr('fill', (d: any) => STATUS_COLOR[d.status] || '#3A4357')
      .attr('stroke', (d: any) => (d.id === selectedKey ? '#FF7A45' : 'transparent'))
      .attr('stroke-width', 3)
      .attr('opacity', 0.9)

    node
      .append('text')
      .text((d: any) => d.node_key.replace('c_', ''))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#0A0E14')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')

    node
      .append('text')
      .text((d: any) => (d.title.length > 18 ? d.title.slice(0, 16) + '…' : d.title))
      .attr('text-anchor', 'middle')
      .attr('dy', 38)
      .attr('fill', '#E8ECF4')
      .attr('font-size', 11)
      .style('pointer-events', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
    }
  }, [nodes, edges, selectedKey])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={480}
      className="rounded-xl border border-white/5 bg-synapse/40"
    />
  )
}
